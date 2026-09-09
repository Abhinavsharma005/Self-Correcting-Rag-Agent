import os
import re
import gc
import shutil
import stat
from pathlib import Path
from typing import Set, Dict, Any, List

# Regex to safely identify UUID-prefixed uploaded documents (8 hex characters + _ + filename)
UPLOAD_FILE_PATTERN = re.compile(r"^([0-9a-fA-F]{8})_(.+)$")

# Regex to safely identify generated chunk vector-store folders (8 hex characters + _ + strategy)
CHROMA_DIR_PATTERN = re.compile(r"^([0-9a-fA-F]{8})_(fixed|recursive|sentence|semantic|parent_child)$")


def _on_rm_error(func, path, exc_info):
    """
    Error handler for Windows file-locking or read-only attribute issues.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def safe_remove_file(file_path: Path) -> bool:
    """Safely removes a file if it exists."""
    try:
        if file_path.is_file():
            file_path.chmod(stat.S_IWRITE)
            file_path.unlink(missing_ok=True)
            return True
    except Exception as e:
        print(f"[Cleanup] Error removing file {file_path}: {e}")
    return False


def safe_remove_dir(dir_path: Path) -> bool:
    """Safely removes a directory tree on Windows."""
    try:
        if dir_path.is_dir():
            shutil.rmtree(str(dir_path), onerror=_on_rm_error)
            return True
    except Exception as e:
        print(f"[Cleanup] Error removing directory {dir_path}: {e}")
    return False


def cleanup_unreferenced_data(
    active_doc_ids: Set[str],
    uploads_dir: Path,
    chroma_dir: Path
) -> Dict[str, Any]:
    """
    Reference-aware cleanup that:
    1. Preserves files/folders referenced by any active session in active_doc_ids.
    2. Preserves unrelated user files (files not matching the 8-hex UUID prefix pattern).
    3. Preserves non-matching Chroma directories (e.g. test_sample_*, custom collections).
    4. Removes obsolete temporary, duplicated, UUID-prefixed upload copies and unused
       vector-store folders that are no longer referenced by active sessions.
    """
    # Safety guard: if active_doc_ids is empty, do not run cleanup to avoid accidental deletion
    if not active_doc_ids:
        return {
            "status": "skipped",
            "reason": "active_doc_ids is empty; cleanup aborted to protect user data",
            "removed_files": [],
            "removed_dirs": []
        }

    # Release any lingering SQLite/Chroma file handles before deleting
    gc.collect()

    removed_files: List[str] = []
    removed_dirs: List[str] = []

    # 1. Clean unreferenced uploads
    if uploads_dir.exists() and uploads_dir.is_dir():
        for item in list(uploads_dir.iterdir()):
            if not item.is_file():
                continue

            match = UPLOAD_FILE_PATTERN.match(item.name)
            if not match:
                # Unrelated user file or non-UUID file -> preserve strictly
                continue

            doc_id = match.group(1).lower()
            if doc_id in {aid.lower() for aid in active_doc_ids}:
                # Actively referenced -> preserve
                continue

            # Obsolete / unreferenced upload copy -> remove
            if safe_remove_file(item):
                removed_files.append(item.name)

    # 2. Clean unreferenced Chroma vector stores
    if chroma_dir.exists() and chroma_dir.is_dir():
        for item in list(chroma_dir.iterdir()):
            if not item.is_dir():
                continue

            match = CHROMA_DIR_PATTERN.match(item.name)
            if not match:
                # Custom collection or baseline vector store (e.g. test_sample_*) -> preserve
                continue

            doc_id = match.group(1).lower()
            if doc_id in {aid.lower() for aid in active_doc_ids}:
                # Actively referenced -> preserve
                continue

            # Unused chunk / vector-store data -> remove
            if safe_remove_dir(item):
                removed_dirs.append(item.name)

    return {
        "status": "success",
        "active_doc_ids": list(active_doc_ids),
        "removed_files": removed_files,
        "removed_dirs": removed_dirs
    }
