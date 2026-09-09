import os
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.main import app, active_documents, SESSIONS_STATE_PATH
from backend.app.config import DATA_DIR, UPLOADS_DIR, CHROMA_DIR


def test_api_stats_and_session():
    with TestClient(app) as client:
        # 1. Test root
        res = client.get("/")
        assert res.status_code == 200

        # 2. Test GET /api/stats
        stats_res = client.get("/api/stats")
        assert stats_res.status_code == 200
        stats_data = stats_res.json()
        assert "document" in stats_data
        assert "evaluation" in stats_data
        print(f"Stats returned: doc={stats_data['document'].get('doc_id')}, has_eval={bool(stats_data['evaluation'])}")

        eval_data = stats_data["evaluation"]
        if eval_data:
            assert "chunking_evaluation" in eval_data
            chunking_eval = eval_data["chunking_evaluation"]
            assert "best_chunking_strategy" in chunking_eval
            assert "best_chunking_accuracy" in chunking_eval
            assert "strategy_metrics" in chunking_eval
            print(f"Evaluation verified: best_strat={chunking_eval['best_chunking_strategy']}, acc={chunking_eval['best_chunking_accuracy']}%")

        # 3. Test POST /api/session/new
        session_res = client.post("/api/session/new")
        assert session_res.status_code == 200
        session_data = session_res.json()
        assert session_data["status"] == "success"
        print(f"Session new result: preserved={session_data['preserved_doc_ids']}, cleaned_files={len(session_data['cleanup'].get('removed_files', []))}")


if __name__ == "__main__":
    test_api_stats_and_session()
    print("\nAPI integration test passed successfully!")
