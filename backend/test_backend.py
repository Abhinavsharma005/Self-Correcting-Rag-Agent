import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.rag.baseline import load_pdf_baseline
from backend.app.rag.chunking import ChunkingManager
from backend.app.eval.harness import EvaluationHarness
from backend.app.rag.graph import run_self_correcting_rag
from backend.app.config import DATA_DIR, CHROMA_DIR

def test_pipeline():
    sample_pdf = os.path.join("Rag", "sample.pdf")
    if not os.path.exists(sample_pdf):
        print(f"Sample PDF not found at {sample_pdf}")
        return
        
    print("1. Loading sample PDF...")
    documents = load_pdf_baseline(sample_pdf)
    print(f"   Loaded {len(documents)} pages.")
    
    print("\n2. Chunking & Indexing across 5 strategies...")
    doc_id = "test_sample"
    processed = ChunkingManager.process_and_index_all(
        documents=documents,
        base_chroma_dir=str(CHROMA_DIR),
        doc_id=doc_id
    )
    for k, v in processed["stats"].items():
        print(f"   Strategy '{k}': {v['num_chunks']} chunks, avg len {v['avg_chunk_len']} chars")
        
    print("\n3. Running Evaluation Harness...")
    eval_report = EvaluationHarness.run_full_evaluation(documents, processed["vector_dbs"])
    best_strat = eval_report["chunking_evaluation"]["best_chunking_strategy"]
    best_acc = eval_report["chunking_evaluation"]["best_chunking_accuracy"]
    print(f"   Best Chunking Strategy: {best_strat} (Accuracy: {best_acc}%)")
    print(f"   Reranker Accuracy Boost: +{eval_report['reranker_evaluation']['accuracy_boost_pct']}%")
    print(f"   Self-Correction Accuracy: {eval_report['system_evaluation']['best_system_accuracy']}%")
    
    print("\n4. Running Self-Correcting RAG Query...")
    best_vdb = processed["vector_dbs"][best_strat]
    query = "What is the summary of this document?"
    res = run_self_correcting_rag(query=query, vector_db=best_vdb, use_reranker=True)
    
    print(f"   Query: {query}")
    print(f"   Answer: {res['answer'][:150]}...")
    print(f"   Citations: {[c['page'] for c in res['citations']]}")
    print(f"   Context Grade: {res['context_grade']['score']}%")
    print(f"   Groundedness Score: {res['answer_grade']['score']}%")
    print(f"   Total Latency: {res['latency_breakdown']['total']}s")
    print(f"   Trace Steps: {[s['step'] + ':' + s['status'] for s in res['trace_steps']]}")
    
    print("\nPipeline test successfully completed!")

if __name__ == "__main__":
    test_pipeline()
