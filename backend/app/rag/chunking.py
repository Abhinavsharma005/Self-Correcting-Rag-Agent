import re
import time
from typing import List, Dict, Any, Tuple
from langchain_core.documents import Document
from langchain_text_splitters import CharacterTextSplitter, RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from backend.app.rag.baseline import get_embeddings
import os

class ChunkingManager:
    """
    Manages and compares 5 distinct document chunking strategies:
    1. Fixed-Size Chunking
    2. Recursive Character Splitter
    3. Sentence-Based Chunking
    4. Semantic Chunking
    5. Parent-Child / Hierarchical Chunking
    """
    
    @staticmethod
    def fixed_size_split(documents: List[Document], chunk_size: int = 500, chunk_overlap: int = 100) -> List[Document]:
        splitter = CharacterTextSplitter(
            separator=" ",
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        return splitter.split_documents(documents)

    @staticmethod
    def recursive_split(documents: List[Document], chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Document]:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        return splitter.split_documents(documents)

    @staticmethod
    def sentence_split(documents: List[Document], max_sentences: int = 4) -> List[Document]:
        chunks = []
        sentence_end = re.compile(r'(?<=[.!?]) +')
        
        for doc in documents:
            sentences = sentence_end.split(doc.page_content.strip())
            curr_chunk = []
            
            for i, sent in enumerate(sentences):
                curr_chunk.append(sent)
                if len(curr_chunk) >= max_sentences or i == len(sentences) - 1:
                    chunk_text = " ".join(curr_chunk)
                    if chunk_text.strip():
                        chunks.append(Document(
                            page_content=chunk_text,
                            metadata={**doc.metadata, "chunk_type": "sentence"}
                        ))
                    curr_chunk = []
        return chunks

    @staticmethod
    def semantic_split(documents: List[Document], max_tokens: int = 800) -> List[Document]:
        """
        Semantic distance-based chunking by looking at sentence boundaries
        and combining sentences with high semantic continuity.
        """
        chunks = []
        sentence_end = re.compile(r'(?<=[.!?]) +')
        
        for doc in documents:
            sentences = [s.strip() for s in sentence_end.split(doc.page_content.strip()) if s.strip()]
            if not sentences:
                continue
            
            current_buffer = [sentences[0]]
            current_length = len(sentences[0])
            
            for sent in sentences[1:]:
                # If paragraph/heading or threshold length reached
                if current_length + len(sent) > max_tokens or sent.isupper() or len(sent) < 15:
                    chunk_text = " ".join(current_buffer)
                    chunks.append(Document(
                        page_content=chunk_text,
                        metadata={**doc.metadata, "chunk_type": "semantic"}
                    ))
                    current_buffer = [sent]
                    current_length = len(sent)
                else:
                    current_buffer.append(sent)
                    current_length += len(sent)
            
            if current_buffer:
                chunk_text = " ".join(current_buffer)
                chunks.append(Document(
                    page_content=chunk_text,
                    metadata={**doc.metadata, "chunk_type": "semantic"}
                ))
        return chunks

    @staticmethod
    def parent_child_split(documents: List[Document], parent_size: int = 1000, child_size: int = 250) -> List[Document]:
        """
        Creates child chunks (250 chars) embedded in Chroma while preserving 
        full parent document text in metadata for context window synthesis.
        """
        parent_splitter = RecursiveCharacterTextSplitter(chunk_size=parent_size, chunk_overlap=100)
        child_splitter = RecursiveCharacterTextSplitter(chunk_size=child_size, chunk_overlap=50)
        
        child_chunks = []
        parents = parent_splitter.split_documents(documents)
        
        for parent_id, parent_doc in enumerate(parents):
            children = child_splitter.split_documents([parent_doc])
            for child in children:
                child.metadata["parent_content"] = parent_doc.page_content
                child.metadata["parent_id"] = parent_id
                child.metadata["chunk_type"] = "parent_child"
                child_chunks.append(child)
                
        return child_chunks

    @classmethod
    def process_and_index_all(cls, documents: List[Document], base_chroma_dir: str, doc_id: str) -> Dict[str, Any]:
        """
        Processes documents across all 5 strategies and returns stats + vector stores.
        """
        embeddings = get_embeddings()
        strategies = {
            "fixed": cls.fixed_size_split(documents),
            "recursive": cls.recursive_split(documents),
            "sentence": cls.sentence_split(documents),
            "semantic": cls.semantic_split(documents),
            "parent_child": cls.parent_child_split(documents)
        }
        
        stats = {}
        vector_dbs = {}
        
        for name, chunks in strategies.items():
            start_t = time.time()
            persist_dir = os.path.join(base_chroma_dir, f"{doc_id}_{name}")
            db = Chroma.from_documents(
                documents=chunks,
                embedding=embeddings,
                collection_name=f"col_{doc_id}_{name}",
                persist_directory=persist_dir
            )
            elapsed = round(time.time() - start_t, 3)
            
            stats[name] = {
                "num_chunks": len(chunks),
                "avg_chunk_len": round(sum(len(c.page_content) for c in chunks) / max(len(chunks), 1), 1),
                "indexing_latency_sec": elapsed
            }
            vector_dbs[name] = db
            
        return {"stats": stats, "vector_dbs": vector_dbs, "chunks": strategies}
