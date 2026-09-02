import time
from typing import List, Dict, Any, Tuple
from langchain_core.documents import Document
from sentence_transformers import CrossEncoder

_cross_encoder_instance = None

def get_cross_encoder():
    global _cross_encoder_instance
    if _cross_encoder_instance is None:
        # Load local open-source cross-encoder model
        _cross_encoder_instance = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _cross_encoder_instance

class RerankerManager:
    """
    Reranks candidate chunks retrieved from vector database using a local Cross-Encoder model.
    """
    
    @staticmethod
    def rerank(
        query: str, 
        candidate_docs: List[Document], 
        top_n: int = 4
    ) -> Tuple[List[Document], Dict[str, Any]]:
        if not candidate_docs:
            return [], {"latency_sec": 0.0, "scores": []}
            
        start_time = time.time()
        model = get_cross_encoder()
        
        # Prepare pairs for scoring: (query, chunk_text)
        pairs = [(query, doc.page_content) for doc in candidate_docs]
        scores = model.predict(pairs)
        
        # Zip documents with scores and sort descending
        doc_score_pairs = list(zip(candidate_docs, [float(s) for s in scores]))
        doc_score_pairs.sort(key=lambda x: x[1], reverse=True)
        
        elapsed = round(time.time() - start_time, 4)
        
        reranked_docs = []
        score_details = []
        
        for doc, score in doc_score_pairs[:top_n]:
            # Attach parent_content if using parent-child chunking
            content_to_use = doc.metadata.get("parent_content", doc.page_content)
            
            # Create fresh document preserving metadata with rerank score
            reranked_doc = Document(
                page_content=content_to_use,
                metadata={**doc.metadata, "rerank_score": round(score, 4)}
            )
            reranked_docs.append(reranked_doc)
            
            page_num = doc.metadata.get("page_label") or doc.metadata.get("page") or 1
            if isinstance(page_num, int):
                page_num += 1
                
            score_details.append({
                "page": page_num,
                "score": round(score, 4),
                "snippet": doc.page_content[:120]
            })
            
        metadata = {
            "rerank_latency_sec": elapsed,
            "top_scores": score_details
        }
        
        return reranked_docs, metadata
