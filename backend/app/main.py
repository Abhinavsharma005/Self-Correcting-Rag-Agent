import os
import shutil
import uuid
import json
from typing import Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.app.config import UPLOADS_DIR, CHROMA_DIR, EVAL_RESULTS_PATH
from backend.app.rag.baseline import load_pdf_baseline
from backend.app.rag.chunking import ChunkingManager
from backend.app.rag.graph import run_self_correcting_rag
from backend.app.eval.harness import EvaluationHarness

app = FastAPI(title="Self-Correcting RAG Agent API", version="1.0.0")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory storage for active document vector DBs
active_documents: Dict[str, Dict[str, Any]] = {}

class QueryRequest(BaseModel):
    doc_id: str
    query: str
    chunking_strategy: Optional[str] = None
    use_reranker: bool = True
    max_retries: int = 2

@app.get("/")
def read_root():
    return {"message": "Self-Correcting RAG Agent API is running."}

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    doc_id = str(uuid.uuid4())[:8]
    file_path = os.path.join(UPLOADS_DIR, f"{doc_id}_{file.filename}")
    
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    file_size_bytes = os.path.getsize(file_path)
    file_size_mb = round(file_size_bytes / (1024 * 1024), 2)
    
    # Load PDF using PyPDFLoader
    documents = load_pdf_baseline(file_path)
    num_pages = len(documents)
    
    # Process across all 5 chunking strategies
    processed = ChunkingManager.process_and_index_all(
        documents=documents,
        base_chroma_dir=str(CHROMA_DIR),
        doc_id=doc_id
    )
    
    # Store active session info
    active_documents[doc_id] = {
        "doc_id": doc_id,
        "filename": file.filename,
        "file_path": file_path,
        "file_size_mb": file_size_mb,
        "num_pages": num_pages,
        "documents": documents,
        "vector_dbs": processed["vector_dbs"],
        "chunk_stats": processed["stats"]
    }
    
    # Run evaluation harness
    eval_report = EvaluationHarness.run_full_evaluation(documents, processed["vector_dbs"])
    
    best_strategy = eval_report["chunking_evaluation"]["best_chunking_strategy"]
    total_chunks = processed["stats"].get(best_strategy, {}).get("num_chunks", 0)
    
    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "file_size_mb": file_size_mb,
        "num_pages": num_pages,
        "total_chunks": total_chunks,
        "chunk_stats": processed["stats"],
        "evaluation": eval_report
    }

@app.post("/api/query")
async def query_rag(req: QueryRequest):
    doc_id = req.doc_id
    if doc_id not in active_documents:
        raise HTTPException(status_code=404, detail="Document session not found. Please upload a PDF first.")
        
    doc_session = active_documents[doc_id]
    eval_report = None
    if os.path.exists(EVAL_RESULTS_PATH):
        try:
            with open(EVAL_RESULTS_PATH, "r", encoding="utf-8") as f:
                eval_report = json.load(f)
        except Exception:
            pass
            
    # Select strategy (or use best strategy from evaluation)
    selected_strategy = req.chunking_strategy
    if not selected_strategy or selected_strategy not in doc_session["vector_dbs"]:
        if eval_report:
            selected_strategy = eval_report["chunking_evaluation"]["best_chunking_strategy"]
        else:
            selected_strategy = "recursive"
            
    vector_db = doc_session["vector_dbs"][selected_strategy]
    
    # Execute LangGraph Self-Correction Pipeline
    result = run_self_correcting_rag(
        query=req.query,
        vector_db=vector_db,
        use_reranker=req.use_reranker,
        max_retries=req.max_retries
    )
    
    return {
        "doc_id": doc_id,
        "query": req.query,
        "chunking_strategy_used": selected_strategy,
        "answer": result["answer"],
        "citations": result["citations"],
        "context_grade": result["context_grade"],
        "answer_grade": result["answer_grade"],
        "self_correction_triggered": result["self_correction_triggered"],
        "retry_count": result["retry_count"],
        "trace_steps": result["trace_steps"],
        "latency_breakdown": result["latency_breakdown"]
    }

@app.get("/api/document/{doc_id}")
async def get_document_pdf(doc_id: str):
    if doc_id not in active_documents:
        # Search uploads directory
        for filename in os.listdir(UPLOADS_DIR):
            if filename.startswith(doc_id):
                return FileResponse(os.path.join(UPLOADS_DIR, filename), media_type="application/pdf")
        raise HTTPException(status_code=404, detail="Document not found.")
    return FileResponse(active_documents[doc_id]["file_path"], media_type="application/pdf")

@app.get("/api/stats/{doc_id}")
@app.get("/api/stats")
async def get_rag_stats(doc_id: Optional[str] = None):
    doc_info = {}
    if doc_id and doc_id in active_documents:
        session = active_documents[doc_id]
        doc_info = {
            "doc_id": session["doc_id"],
            "filename": session["filename"],
            "num_pages": session["num_pages"],
            "file_size_mb": session["file_size_mb"]
        }
    elif active_documents:
        first_id = list(active_documents.keys())[0]
        session = active_documents[first_id]
        doc_info = {
            "doc_id": session["doc_id"],
            "filename": session["filename"],
            "num_pages": session["num_pages"],
            "file_size_mb": session["file_size_mb"]
        }
        
    eval_report = {}
    if os.path.exists(EVAL_RESULTS_PATH):
        try:
            with open(EVAL_RESULTS_PATH, "r", encoding="utf-8") as f:
                eval_report = json.load(f)
        except Exception:
            pass
            
    return {
        "document": doc_info,
        "evaluation": eval_report
    }

@app.post("/api/eval/run")
async def run_evaluation(doc_id: str):
    if doc_id not in active_documents:
        raise HTTPException(status_code=404, detail="Document session not found.")
    session = active_documents[doc_id]
    report = EvaluationHarness.run_full_evaluation(session["documents"], session["vector_dbs"])
    return report
