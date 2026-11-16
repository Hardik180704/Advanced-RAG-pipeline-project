import threading
from typing import Dict

from langchain_core.chat_history import InMemoryChatMessageHistory

from src.rag_pipeline import load_pipeline

_LOCK = threading.Lock()
_PIPELINE: Dict[str, object] | None = None
_SESSIONS: Dict[str, InMemoryChatMessageHistory] = {}


def get_pipeline() -> Dict[str, object]:
    """
    Lazily load the retrieval pipeline once per process.

    The vector store, BM25 index and parent lookup are read from disk on the
    first request and kept in memory afterwards, so every later question is
    answerable without re-reading the index.

    Returns:
        The pipeline dictionary produced by `load_pipeline()`.
    """
    global _PIPELINE
    if _PIPELINE is None:
        with _LOCK:
            if _PIPELINE is None:
                _PIPELINE = load_pipeline()
    return _PIPELINE


def reset_pipeline() -> None:
    """Drop the cached pipeline so the next request reloads it from disk."""
    global _PIPELINE
    with _LOCK:
        _PIPELINE = None


def get_memory(session_id: str) -> InMemoryChatMessageHistory:
    """
    Return (and create if needed) the chat history for one browser session.

    Args:
        session_id: Stable identifier sent by the frontend.

    Returns:
        The conversation history object for that session.
    """
    with _LOCK:
        if session_id not in _SESSIONS:
            _SESSIONS[session_id] = InMemoryChatMessageHistory()
        return _SESSIONS[session_id]


def clear_memory(session_id: str) -> None:
    """Forget the conversation stored under `session_id`."""
    with _LOCK:
        _SESSIONS.pop(session_id, None)
