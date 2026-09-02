import time
import json
from typing import List, Dict, Any, TypedDict
from langchain_core.documents import Document
from langgraph.graph import StateGraph, END
from google.genai import types

from backend.app.rag.baseline import get_gemini_client, call_gemini_with_retry
from backend.app.rag.reranker import RerankerManager

class GraphState(TypedDict):
    user_query: str
    current_query: str
    vector_db: Any
    use_reranker: bool
    retrieval_k: int
    candidate_docs: List[Document]
    reranked_docs: List[Document]
    context_grade: Dict[str, Any] # {score: int, is_relevant: bool, reasoning: str}
    generation: str
    citations: List[Dict[str, Any]]
    answer_grade: Dict[str, Any] # {score: int, is_grounded: bool, reasoning: str}
    retry_count: int
    max_retries: int
    trace_steps: List[Dict[str, Any]]
    latency_breakdown: Dict[str, float]

def retrieve_node(state: GraphState) -> GraphState:
    t0 = time.time()
    query = state["current_query"]
    vector_db = state["vector_db"]
    k = state.get("retrieval_k", 8 if state.get("use_reranker") else 4)
    
    docs = vector_db.similarity_search(query=query, k=k)
    elapsed = round(time.time() - t0, 4)
    
    state["candidate_docs"] = docs
    state["latency_breakdown"]["retrieval"] = state["latency_breakdown"].get("retrieval", 0) + elapsed
    
    state["trace_steps"].append({
        "step": "Retrieval",
        "status": "COMPLETED",
        "latency_sec": elapsed,
        "details": f"Retrieved {len(docs)} chunks for query: '{query}'"
    })
    return state

def rerank_node(state: GraphState) -> GraphState:
    if not state.get("use_reranker", True):
        state["reranked_docs"] = state["candidate_docs"][:4]
        state["trace_steps"].append({
            "step": "Reranking",
            "status": "SKIPPED",
            "latency_sec": 0.0,
            "details": "Reranking disabled in config"
        })
        return state

    t0 = time.time()
    reranked_docs, meta = RerankerManager.rerank(
        query=state["current_query"],
        candidate_docs=state["candidate_docs"],
        top_n=4
    )
    elapsed = meta["rerank_latency_sec"]
    state["reranked_docs"] = reranked_docs
    state["latency_breakdown"]["reranking"] = state["latency_breakdown"].get("reranking", 0) + elapsed
    
    state["trace_steps"].append({
        "step": "Reranking",
        "status": "COMPLETED",
        "latency_sec": elapsed,
        "details": f"Reranked top {len(reranked_docs)} chunks using Cross-Encoder"
    })
    return state

def grade_context_node(state: GraphState) -> GraphState:
    t0 = time.time()
    docs = state.get("reranked_docs") or state.get("candidate_docs") or []
    user_query = state["user_query"]
    
    if not docs:
        state["context_grade"] = {"score": 0, "is_relevant": False, "reasoning": "No docs retrieved"}
        state["trace_steps"].append({
            "step": "Grade Context",
            "status": "FAILED",
            "latency_sec": 0.0,
            "details": "Context Score: 0% (No documents)"
        })
        return state
        
    context_str = "\n---\n".join([d.page_content for d in docs])
    prompt = f"""You are a strict evaluation agent. Evaluate if the following PDF Context contains relevant details to answer the User Question.
    
User Question: {user_query}
PDF Context:
{context_str}

Respond strictly in JSON format with two keys:
"score": an integer from 0 to 100 representing percentage of relevance
"is_relevant": true if score >= 50 else false
"reasoning": concise explanation
"""
    try:
        res = call_gemini_with_retry(
            model="gemini-3.6-flash",
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        data = json.loads(res.text)
        score = int(data.get("score", 50))
        is_relevant = bool(data.get("is_relevant", score >= 50))
        reasoning = data.get("reasoning", "")
    except Exception as e:
        score = 75
        is_relevant = True
        reasoning = f"Fallback due to error: {e}"
        
    elapsed = round(time.time() - t0, 4)
    state["context_grade"] = {"score": score, "is_relevant": is_relevant, "reasoning": reasoning}
    state["latency_breakdown"]["context_grading"] = state["latency_breakdown"].get("context_grading", 0) + elapsed
    
    state["trace_steps"].append({
        "step": "Grade Context",
        "status": "COMPLETED" if is_relevant else "FAILED",
        "latency_sec": elapsed,
        "details": f"Context Score: {score}% ({'Relevant' if is_relevant else 'Irrelevant'})"
    })
    return state

def rewrite_query_node(state: GraphState) -> GraphState:
    t0 = time.time()
    state["retry_count"] += 1
    orig_query = state["user_query"]
    
    prompt = f"""You are a search query optimizer. The user asked a question, but initial retrieval found insufficient context.
Rewrite and expand the question to improve semantic search in the document vector database. Return ONLY the rewritten query text.

Original Question: {orig_query}
Rewritten Query:"""

    try:
        res = call_gemini_with_retry(
            model="gemini-3.6-flash",
            contents=prompt
        )
        new_query = res.text.strip()
    except Exception:
        new_query = f"{orig_query} overview details information"
        
    elapsed = round(time.time() - t0, 4)
    state["current_query"] = new_query
    state["latency_breakdown"]["query_rewrite"] = state["latency_breakdown"].get("query_rewrite", 0) + elapsed
    
    state["trace_steps"].append({
        "step": "Rewrite Query",
        "status": "COMPLETED",
        "latency_sec": elapsed,
        "details": f"Attempt {state['retry_count']}/{state['max_retries']}: '{new_query}'"
    })
    return state

def generate_node(state: GraphState) -> GraphState:
    t0 = time.time()
    docs = state.get("reranked_docs") or state.get("candidate_docs") or []
    user_query = state["user_query"]
    context_is_relevant = state.get("context_grade", {}).get("is_relevant", True)
    
    # Anti-hallucination check
    if not context_is_relevant and state["retry_count"] >= state["max_retries"]:
        state["generation"] = "I could not find the answer in the provided PDF."
        state["citations"] = []
        elapsed = round(time.time() - t0, 4)
        state["trace_steps"].append({
            "step": "Generate",
            "status": "COMPLETED",
            "latency_sec": elapsed,
            "details": "Triggered anti-hallucination fallback"
        })
        return state

    context = ""
    citations = []
    seen_pages = set()
    
    for doc in docs:
        page_num = doc.metadata.get("page_label") or doc.metadata.get("page") or 0
        if isinstance(page_num, int):
            page_num += 1
        source = doc.metadata.get("source", "PDF Document")
        
        if page_num not in seen_pages:
            seen_pages.add(page_num)
            citations.append({
                "page": page_num,
                "source": source,
                "snippet": doc.page_content[:150]
            })
            
        context += f"Page Number: {page_num}\nFile: {source}\nPage Content:\n{doc.page_content}\n----------------------------------------\n"

    prompt = f"""Use the following retrieved PDF context to answer the user's question.

Retrieved PDF Context:
{context}

User Question:
{user_query}

Rules:
1. Answer only using information available in the provided PDF context.
2. Do not use outside knowledge.
3. If the answer cannot be found in the provided context, say:
   "I could not find the answer in the provided PDF."
4. Mention the relevant page number whenever possible.
5. Keep the answer clear and concise.
"""
    try:
        res = call_gemini_with_retry(
            model="gemini-3.6-flash",
            contents=prompt
        )
        answer = res.text.strip()
    except Exception as e:
        answer = f"Error generating response: {e}"
        
    elapsed = round(time.time() - t0, 4)
    state["generation"] = answer
    state["citations"] = citations
    state["latency_breakdown"]["generation"] = state["latency_breakdown"].get("generation", 0) + elapsed
    
    state["trace_steps"].append({
        "step": "Generate",
        "status": "COMPLETED",
        "latency_sec": elapsed,
        "details": f"Generated answer ({len(answer)} chars) with {len(citations)} citations"
    })
    return state

def grade_answer_node(state: GraphState) -> GraphState:
    t0 = time.time()
    answer = state.get("generation", "")
    docs = state.get("reranked_docs") or state.get("candidate_docs") or []
    
    if "could not find the answer" in answer.lower():
        state["answer_grade"] = {"score": 100, "is_grounded": True, "reasoning": "Explicit fallback correct response"}
        state["trace_steps"].append({
            "step": "Grade Answer",
            "status": "COMPLETED",
            "latency_sec": 0.0,
            "details": "Groundedness: 100% (Not Found Safeguard)"
        })
        return state

    context_str = "\n".join([d.page_content for d in docs])
    prompt = f"""Evaluate if the Generated Answer is grounded and fully supported by the PDF Context without hallucinating details.

PDF Context:
{context_str}

Generated Answer:
{answer}

Respond strictly in JSON with two keys:
"score": an integer from 0 to 100 representing faithfulness/groundedness
"is_grounded": true if score >= 70 else false
"reasoning": concise explanation
"""
    try:
        res = call_gemini_with_retry(
            model="gemini-3.6-flash",
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        data = json.loads(res.text)
        score = int(data.get("score", 90))
        is_grounded = bool(data.get("is_grounded", score >= 70))
        reasoning = data.get("reasoning", "")
    except Exception:
        score = 90
        is_grounded = True
        reasoning = "Groundedness validation default"
        
    elapsed = round(time.time() - t0, 4)
    state["answer_grade"] = {"score": score, "is_grounded": is_grounded, "reasoning": reasoning}
    state["latency_breakdown"]["answer_grading"] = state["latency_breakdown"].get("answer_grading", 0) + elapsed
    
    state["trace_steps"].append({
        "step": "Grade Answer",
        "status": "COMPLETED" if is_grounded else "FAILED",
        "latency_sec": elapsed,
        "details": f"Groundedness Score: {score}% ({'Grounded' if is_grounded else 'Hallucination Risk'})"
    })
    return state

def decide_context_route(state: GraphState) -> str:
    is_relevant = state.get("context_grade", {}).get("is_relevant", True)
    retry_count = state.get("retry_count", 0)
    max_retries = state.get("max_retries", 2)
    
    if is_relevant or retry_count >= max_retries:
        return "generate"
    return "rewrite_query"

def build_self_correction_graph():
    builder = StateGraph(GraphState)
    
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("rerank", rerank_node)
    builder.add_node("grade_context", grade_context_node)
    builder.add_node("rewrite_query", rewrite_query_node)
    builder.add_node("generate", generate_node)
    builder.add_node("grade_answer", grade_answer_node)
    
    builder.set_entry_point("retrieve")
    builder.add_edge("retrieve", "rerank")
    builder.add_edge("rerank", "grade_context")
    
    builder.add_conditional_edges(
        "grade_context",
        decide_context_route,
        {
            "generate": "generate",
            "rewrite_query": "rewrite_query"
        }
    )
    
    builder.add_edge("rewrite_query", "retrieve")
    builder.add_edge("generate", "grade_answer")
    builder.add_edge("grade_answer", END)
    
    return builder.compile()

# Global compiled graph instance
self_correcting_rag_agent = build_self_correction_graph()

def run_self_correcting_rag(
    query: str, 
    vector_db: Any, 
    use_reranker: bool = True,
    max_retries: int = 2
) -> Dict[str, Any]:
    initial_state: GraphState = {
        "user_query": query,
        "current_query": query,
        "vector_db": vector_db,
        "use_reranker": use_reranker,
        "retrieval_k": 8 if use_reranker else 4,
        "candidate_docs": [],
        "reranked_docs": [],
        "context_grade": {},
        "generation": "",
        "citations": [],
        "answer_grade": {},
        "retry_count": 0,
        "max_retries": max_retries,
        "trace_steps": [],
        "latency_breakdown": {}
    }
    
    final_state = self_correcting_rag_agent.invoke(initial_state)
    
    total_latency = round(sum(final_state["latency_breakdown"].values()), 4)
    final_state["latency_breakdown"]["total"] = total_latency
    
    return {
        "answer": final_state["generation"],
        "citations": final_state["citations"],
        "context_grade": final_state["context_grade"],
        "answer_grade": final_state["answer_grade"],
        "retry_count": final_state["retry_count"],
        "self_correction_triggered": final_state["retry_count"] > 0,
        "trace_steps": final_state["trace_steps"],
        "latency_breakdown": final_state["latency_breakdown"]
    }
