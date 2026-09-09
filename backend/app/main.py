import os
import shutil
import uuid
import json
import re
from pathlib import Path
from typing import Dict, Any, Optional, Set
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.app.config import DATA_DIR, UPLOADS_DIR, CHROMA_DIR, EVAL_RESULTS_PATH
from backend.app.rag.baseline import load_pdf_baseline, get_embeddings
from backend.app.rag.chunking import ChunkingManager
from backend.app.rag.graph import run_self_correcting_rag
from backend.app.rag.cleanup import cleanup_unreferenced_data
from backend.app.eval.harness import EvaluationHarness
from langchain_community.vectorstores import Chroma

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
SESSIONS_STATE_PATH = DATA_DIR / "active_sessions.json"


def save_session_state():
    """Persists active session metadata to disk for reference-aware tracking across restarts."""
    try:
        sessions_meta = {}
        for d_id, session in active_documents.items():
            sessions_meta[d_id] = {
                "doc_id": session.get("doc_id", d_id),
                "filename": session.get("filename", ""),
                "file_path": session.get("file_path", ""),
                "file_size_mb": session.get("file_size_mb", 0),
                "num_pages": session.get("num_pages", 0),
                "total_chunks": session.get("total_chunks", 0),
                "chunk_stats": session.get("chunk_stats", {}),
            }
        payload = {
            "active_doc_id": list(active_documents.keys())[-1] if active_documents else None,
            "sessions": sessions_meta
        }
        with open(SESSIONS_STATE_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
    except Exception as e:
        print(f"[Session] Warning saving session state: {e}")


def load_session_state():
    """Restores active document session references on server startup."""
    if not SESSIONS_STATE_PATH.exists():
        # If no active_sessions.json exists, detect if the latest upload is available
        _restore_latest_available_session()
        return

    try:
        with open(SESSIONS_STATE_PATH, "r", encoding="utf-8") as f:
            state = json.load(f)

        eval_report = None
        if os.path.exists(EVAL_RESULTS_PATH):
            try:
                with open(EVAL_RESULTS_PATH, "r", encoding="utf-8") as ef:
                    eval_report = json.load(ef)
            except Exception:
                pass

        embeddings = None
        for d_id, meta in state.get("sessions", {}).items():
            f_path = meta.get("file_path")
            if f_path and os.path.exists(f_path):
                # Reconnect existing chroma collections if directories exist
                vector_dbs = {}
                for strat in ["fixed", "recursive", "sentence", "semantic", "parent_child"]:
                    p_dir = os.path.join(str(CHROMA_DIR), f"{d_id}_{strat}")
                    if os.path.isdir(p_dir):
                        if embeddings is None:
                            embeddings = get_embeddings()
                        vector_dbs[strat] = Chroma(
                            persist_directory=p_dir,
                            embedding_function=embeddings,
                            collection_name=f"col_{d_id}_{strat}"
                        )

                active_documents[d_id] = {
                    "doc_id": d_id,
                    "filename": meta.get("filename", "document.pdf"),
                    "file_path": f_path,
                    "file_size_mb": meta.get("file_size_mb", 0),
                    "num_pages": meta.get("num_pages", 0),
                    "total_chunks": meta.get("total_chunks", 0),
                    "chunk_stats": meta.get("chunk_stats", {}),
                    "vector_dbs": vector_dbs,
                    "documents": [],
                    "evaluation": eval_report
                }
    except Exception as e:
        print(f"[Session] Error restoring session state: {e}")
        _restore_latest_available_session()


def _restore_latest_available_session():
    """Fallback: if active_sessions.json is missing, detect newest valid upload in uploads dir."""
    if not UPLOADS_DIR.exists():
        return
    upload_files = sorted(
        [f for f in UPLOADS_DIR.iterdir() if f.is_file() and re.match(r"^[0-9a-fA-F]{8}_.+\.pdf$", f.name)],
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )
    if not upload_files:
        return

    latest_file = upload_files[0]
    match = re.match(r"^([0-9a-fA-F]{8})_(.+)$", latest_file.name)
    if not match:
        return

    doc_id = match.group(1)
    original_filename = match.group(2)

    eval_report = None
    if os.path.exists(EVAL_RESULTS_PATH):
        try:
            with open(EVAL_RESULTS_PATH, "r", encoding="utf-8") as ef:
                eval_report = json.load(ef)
        except Exception:
            pass

    embeddings = None
    vector_dbs = {}
    for strat in ["fixed", "recursive", "sentence", "semantic", "parent_child"]:
        p_dir = os.path.join(str(CHROMA_DIR), f"{doc_id}_{strat}")
        if os.path.isdir(p_dir):
            if embeddings is None:
                embeddings = get_embeddings()
            vector_dbs[strat] = Chroma(
                persist_directory=p_dir,
                embedding_function=embeddings,
                collection_name=f"col_{doc_id}_{strat}"
            )

    active_documents[doc_id] = {
        "doc_id": doc_id,
        "filename": original_filename,
        "file_path": str(latest_file),
        "file_size_mb": round(latest_file.stat().st_size / (1024 * 1024), 2),
        "num_pages": 1,
        "total_chunks": 0,
        "chunk_stats": {},
        "vector_dbs": vector_dbs,
        "documents": [],
        "evaluation": eval_report
    }
    save_session_state()


@app.on_event("startup")
def startup_event():
    load_session_state()


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
    
    # Run evaluation harness
    eval_report = EvaluationHarness.run_full_evaluation(documents, processed["vector_dbs"])
    best_strategy = eval_report["chunking_evaluation"]["best_chunking_strategy"]
    total_chunks = processed["stats"].get(best_strategy, {}).get("num_chunks", 0)

    # Store active session info (including evaluation for reliable telemetry binding)
    active_documents[doc_id] = {
        "doc_id": doc_id,
        "filename": file.filename,
        "file_path": file_path,
        "file_size_mb": file_size_mb,
        "num_pages": num_pages,
        "total_chunks": total_chunks,
        "documents": documents,
        "vector_dbs": processed["vector_dbs"],
        "chunk_stats": processed["stats"],
        "evaluation": eval_report
    }

    # Persist session state so this document is known across restarts
    save_session_state()

    # Reference-aware cleanup: preserve current document and any active sessions,
    # safely remove obsolete temporary/duplicate copies and unused chunk/vector-store folders.
    cleanup_unreferenced_data(
        active_doc_ids=set(active_documents.keys()),
        uploads_dir=UPLOADS_DIR,
        chroma_dir=CHROMA_DIR
    )

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
    eval_report = doc_session.get("evaluation")
    if not eval_report and os.path.exists(EVAL_RESULTS_PATH):
        try:
            with open(EVAL_RESULTS_PATH, "r", encoding="utf-8") as f:
                eval_report = json.load(f)
        except Exception:
            pass
            
    # Select strategy (or use best strategy from evaluation)
    selected_strategy = req.chunking_strategy
    if not selected_strategy or selected_strategy not in doc_session["vector_dbs"]:
        if eval_report and "chunking_evaluation" in eval_report:
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
    eval_report = {}

    target_session = None
    if doc_id and doc_id in active_documents:
        target_session = active_documents[doc_id]
    elif active_documents:
        # Latest active document session
        target_session = list(active_documents.values())[-1]

    if target_session:
        doc_info = {
            "doc_id": target_session["doc_id"],
            "filename": target_session["filename"],
            "num_pages": target_session["num_pages"],
            "file_size_mb": target_session["file_size_mb"],
            "total_chunks": target_session.get("total_chunks", 0),
            "chunk_stats": target_session.get("chunk_stats", {})
        }
        eval_report = target_session.get("evaluation") or {}

    if not eval_report and os.path.exists(EVAL_RESULTS_PATH):
        try:
            with open(EVAL_RESULTS_PATH, "r", encoding="utf-8") as f:
                eval_report = json.load(f)
        except Exception:
            pass
            
    return {
        "document": doc_info,
        "evaluation": eval_report
    }


@app.post("/api/session/new")
async def new_document_session(preserve_doc_id: Optional[str] = None):
    """
    Safely starts a new document session, preserving active session(s)
    while cleaning up unreferenced temporary/duplicate uploads and vector stores.
    """
    preserved_ids: Set[str] = set()
    if preserve_doc_id and preserve_doc_id in active_documents:
        preserved_ids.add(preserve_doc_id)
    elif active_documents:
        latest_id = list(active_documents.keys())[-1]
        preserved_ids.add(latest_id)

    # Retain only preserved sessions in memory
    for d_id in list(active_documents.keys()):
        if d_id not in preserved_ids:
            del active_documents[d_id]

    save_session_state()
    cleanup_result = cleanup_unreferenced_data(
        active_doc_ids=preserved_ids,
        uploads_dir=UPLOADS_DIR,
        chroma_dir=CHROMA_DIR
    )

    return {
        "status": "success",
        "preserved_doc_ids": list(preserved_ids),
        "cleanup": cleanup_result
    }


@app.post("/api/cleanup")
async def trigger_cleanup():
    """Manual trigger for reference-aware cleanup."""
    active_ids = set(active_documents.keys())
    return cleanup_unreferenced_data(
        active_doc_ids=active_ids,
        uploads_dir=UPLOADS_DIR,
        chroma_dir=CHROMA_DIR
    )


@app.post("/api/eval/run")
async def run_evaluation(doc_id: str):
    if doc_id not in active_documents:
        raise HTTPException(status_code=404, detail="Document session not found.")
    session = active_documents[doc_id]
    report = EvaluationHarness.run_full_evaluation(session["documents"], session["vector_dbs"])
    session["evaluation"] = report
    return report
