import os
import sys
import tempfile
import shutil
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.rag.cleanup import cleanup_unreferenced_data, UPLOAD_FILE_PATTERN, CHROMA_DIR_PATTERN


def test_safety_guard_empty_ids():
    """Verify that cleanup never deletes anything if active_doc_ids is empty."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        uploads = Path(tmp_dir) / "uploads"
        chroma = Path(tmp_dir) / "chroma_db"
        uploads.mkdir()
        chroma.mkdir()

        test_file = uploads / "12345678_test.pdf"
        test_file.write_text("dummy")

        test_chroma = chroma / "12345678_fixed"
        test_chroma.mkdir()

        res = cleanup_unreferenced_data(active_doc_ids=set(), uploads_dir=uploads, chroma_dir=chroma)
        assert res["status"] == "skipped"
        assert test_file.exists()
        assert test_chroma.exists()
        print("PASS: test_safety_guard_empty_ids")


def test_preserves_active_and_unrelated_files():
    """Verify active documents and unrelated user files are preserved, and only obsolete UUID files are removed."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        uploads = Path(tmp_dir) / "uploads"
        chroma = Path(tmp_dir) / "chroma_db"
        uploads.mkdir()
        chroma.mkdir()

        # 1. Active document
        active_id = "aabbccdd"
        active_file = uploads / f"{active_id}_active.pdf"
        active_file.write_text("active document")
        active_chroma = chroma / f"{active_id}_fixed"
        active_chroma.mkdir()

        # 2. Unrelated user files (no 8-hex UUID prefix)
        user_file = uploads / "my_custom_report.pdf"
        user_file.write_text("user report")
        baseline_chroma = chroma / "test_sample_fixed"
        baseline_chroma.mkdir()

        # 3. Obsolete / unreferenced files
        obsolete_id = "11223344"
        obsolete_file = uploads / f"{obsolete_id}_old_doc.pdf"
        obsolete_file.write_text("old")
        obsolete_chroma = chroma / f"{obsolete_id}_parent_child"
        obsolete_chroma.mkdir()

        res = cleanup_unreferenced_data(
            active_doc_ids={active_id},
            uploads_dir=uploads,
            chroma_dir=chroma
        )

        assert res["status"] == "success"
        # Active file & chroma preserved
        assert active_file.exists(), "Active file should be preserved"
        assert active_chroma.exists(), "Active chroma should be preserved"

        # Unrelated user file & baseline chroma preserved
        assert user_file.exists(), "Unrelated user file must not be deleted"
        assert baseline_chroma.exists(), "Custom/baseline chroma must not be deleted"

        # Obsolete file & chroma removed
        assert not obsolete_file.exists(), "Obsolete file should be removed"
        assert not obsolete_chroma.exists(), "Obsolete chroma should be removed"
        assert f"{obsolete_id}_old_doc.pdf" in res["removed_files"]
        assert f"{obsolete_id}_parent_child" in res["removed_dirs"]

        print("PASS: test_preserves_active_and_unrelated_files")


def test_pattern_matching():
    """Verify regex patterns match intended 8-hex UUID formats and reject non-UUID patterns."""
    assert UPLOAD_FILE_PATTERN.match("489d799f_EdgeAI.pdf")
    assert UPLOAD_FILE_PATTERN.match("55a56cb6_Edge_AI_4_Member_Presentation.pdf")
    assert not UPLOAD_FILE_PATTERN.match("sample.pdf")
    assert not UPLOAD_FILE_PATTERN.match("custom_1234_test.pdf")

    assert CHROMA_DIR_PATTERN.match("489d799f_fixed")
    assert CHROMA_DIR_PATTERN.match("489d799f_parent_child")
    assert CHROMA_DIR_PATTERN.match("489d799f_recursive")
    assert CHROMA_DIR_PATTERN.match("489d799f_sentence")
    assert CHROMA_DIR_PATTERN.match("489d799f_semantic")
    assert not CHROMA_DIR_PATTERN.match("test_sample_fixed")
    assert not CHROMA_DIR_PATTERN.match("chroma.sqlite3")
    print("PASS: test_pattern_matching")


if __name__ == "__main__":
    test_safety_guard_empty_ids()
    test_preserves_active_and_unrelated_files()
    test_pattern_matching()
    print("\nAll cleanup unit tests passed successfully!")
