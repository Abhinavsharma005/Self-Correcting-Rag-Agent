import os
from typing import List, Dict, Any, Tuple
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from google import genai
from google.genai import types

from backend.app.config import GEMINI_API_KEY, CHROMA_DIR

# Global shared embeddings model (cached)
_embeddings_instance = None

def get_embeddings():
    global _embeddings_instance
    if _embeddings_instance is None:
        _embeddings_instance = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
    return _embeddings_instance

def get_gemini_client():
    if GEMINI_API_KEY:
        return genai.Client(api_key=GEMINI_API_KEY)
    return genai.Client()

def call_gemini_with_retry(contents, model="gemini-3.6-flash", config=None, max_retries=3):
    import time
    client = get_gemini_client()
    for attempt in range(max_retries):
        try:
            if config:
                return client.models.generate_content(model=model, contents=contents, config=config)
            return client.models.generate_content(model=model, contents=contents)
        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise e

SYSTEM_PROMPT = """
You are Alexa, a helpful AI assistant that answers questions
strictly based on the provided PDF context.

Rules:
1. Answer only using information available in the provided PDF context.
2. Do not use outside knowledge.
3. If the answer cannot be found in the provided context, say:
   "I could not find the answer in the provided PDF."
4. Mention the relevant page number whenever possible.
5. Keep the answer clear and concise.
6. Remember the previous conversation so the user can ask
   follow-up questions about previous answers.
"""

def load_pdf_baseline(pdf_path: str):
    loader = PyPDFLoader(pdf_path)
    return loader.load()

def build_baseline_index(documents, collection_name: str = "baseline_pdf"):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    chunks = text_splitter.split_documents(documents)
    embeddings = get_embeddings()
    
    persist_path = os.path.join(CHROMA_DIR, collection_name)
    vector_db = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=persist_path
    )
    return vector_db, chunks

def query_baseline_rag(user_query: str, vector_db, k: int = 4) -> Tuple[str, List[Dict[str, Any]]]:
    search_results = vector_db.similarity_search(query=user_query, k=k)
    
    context = ""
    citations = []
    for result in search_results:
        page_num = result.metadata.get("page_label") or result.metadata.get("page") or 1
        # Convert 0-indexed to 1-indexed if int
        if isinstance(page_num, int):
            page_num += 1
        source = result.metadata.get("source", "Unknown")
        citations.append({
            "page": page_num,
            "source": source,
            "snippet": result.page_content[:150]
        })
        context += f"Page Number: {page_num}\nFile: {source}\nPage Content:\n{result.page_content}\n----------------------------------------\n"

    prompt = f"Use the following retrieved PDF context to answer the user's question.\n\nRetrieved PDF Context:\n{context}\n\nUser Question:\n{user_query}"
    
    client = get_gemini_client()
    config = types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT)
    chat = client.chats.create(model="gemini-3.6-flash", config=config)
    response = chat.send_message(prompt)
    
    return response.text, citations
