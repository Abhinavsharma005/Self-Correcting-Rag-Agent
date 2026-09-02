import os
import requests
from typing import List, Tuple, Dict
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

def call_ollama(prompt: str, model: str = DEFAULT_OLLAMA_MODEL, json_format: bool = False, system_prompt: str = None) -> str:
    """
    Calls local Ollama server for generation and structured JSON grading.
    100% free, runs locally, no rate limits.
    """
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if json_format:
        payload["format"] = "json"
    if system_prompt:
        payload["system"] = system_prompt
        
    res = requests.post(OLLAMA_URL, json=payload, timeout=60)
    res.raise_for_status()
    return res.json().get("response", "").strip()

# Backward compatibility alias
call_gemini_with_retry = call_ollama

SYSTEM_PROMPT = """
You are Alexa, a helpful AI assistant that answers questions
strictly based on the provided PDF context.
"""

def get_embeddings():
    """Returns local HuggingFace embeddings (all-MiniLM-L6-v2)."""
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def load_pdf(pdf_path: str) -> List:
    """Loads PDF pages using PyPDFLoader."""
    loader = PyPDFLoader(pdf_path)
    return loader.load()

load_pdf_baseline = load_pdf

def split_pdf_into_chunks(documents: List, chunk_size: int = 1000, chunk_overlap: int = 200) -> List:
    """Splits documents into text chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    return splitter.split_documents(documents)

def create_vector_store(chunks: List, persist_directory: str = None) -> Chroma:
    """Creates in-memory or persisted Chroma vector store."""
    embeddings = get_embeddings()
    vector_db = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=persist_directory
    )
    return vector_db

def run_baseline_rag(query: str, vector_db: Chroma) -> Tuple[str, List[Dict]]:
    """Runs baseline RAG logic matching original baseline script behavior."""
    docs = vector_db.similarity_search(query=query, k=4)
    
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
{query}

Rules:
1. Answer only using information available in the provided PDF context.
2. Do not use outside knowledge.
3. If the answer cannot be found in the provided context, say:
   "I could not find the answer in the provided PDF."
4. Mention the relevant page number whenever possible.
5. Keep the answer clear and concise.
"""
    answer = call_ollama(prompt=prompt, system_prompt=SYSTEM_PROMPT)
    return answer, citations
