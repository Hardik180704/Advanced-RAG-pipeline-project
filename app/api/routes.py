import json
import logging
import uuid
from pathlib import Path
from typing import Dict, Generator, List

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

import config
from app.api.schemas import AskRequest, AskResponse, DebugReport, Source, StatusResponse
from app import state
from app.stages import answer, gather_context, no_context_response, source_label, stream_tokens
from src.ingestion import SUPPORTED_EXTENSIONS, load_document
from src.indexing import clear_index, index_summary, update_index
from src.rag_pipeline import summarise_documents
from src.reranking import reranker_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


def _to_source(document: Dict[str, object] | object) -> Source:
    """
    Convert a summarised document (or raw Document) into the Source schema.

    Args:
        document: Output of `summarise_documents()` or a raw Document.

    Returns:
        A Source object safe to embed in JSON responses.
    """
    if isinstance(document, dict):
        return Source(
            label=str(document.get("source", "unknown file")),
            score=document.get("score"),
            preview=str(document.get("preview", "")),
        )
    return Source(label=source_label(document))


def _serialize(payload: Dict[str, object]) -> AskResponse:
    """
    Convert the internal answer payload into the API response model.

    Args:
        payload: The dictionary produced by `stages.answer()`.

    Returns:
        The AskResponse model with sources and debug serialised.
    """
    sources = [_to_source(document) for document in payload["sources"]]
    debug = DebugReport(
        generated_queries=payload["debug"]["generated_queries"],
        retrieved=[_to_source(document) for document in payload["debug"]["retrieved"]],
        reranked=[_to_source(document) for document in payload["debug"]["reranked"]],
        final_context=[_to_source(document) for document in payload["debug"]["final_context"]],
    )
    return AskResponse(answer=payload["answer"], sources=sources, debug=debug)


def _sse(event: str, data: dict) -> str:
    """Format one server-sent event frame."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.get("/health")
def health() -> dict:
    """Liveness probe target. Never touches the pipeline or the models."""
    return {"status": "ok"}


@router.get("/status", response_model=StatusResponse)
def status() -> StatusResponse:
    """Runtime settings for the sidebar badges."""
    return StatusResponse(
        status="ok",
        model=config.OPENAI_CHAT_MODEL,
        vector_db=config.VECTOR_DB,
        reranker=reranker_status(),
    )


_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB per file


@router.get("/documents")
def documents() -> dict:
    """Indexed library summary: chunk counts and source filenames."""
    return index_summary()


@router.post("/documents")
async def upload_documents(files: List[UploadFile] = File(...)) -> dict:
    """
    Ingest uploaded PDF/DOCX/TXT files into the index incrementally.

    Files are stored in data/documents so they persist between restarts,
    cleaned and chunked exactly like the CLI build, and only the new chunks
    are embedded (re-runs of identical files are skipped as duplicates).

    Raises:
        HTTPException 400: No supported files were provided.
        HTTPException 413: A file exceeds the 20 MB limit.
        HTTPException 503: The index cannot be opened yet.
    """
    accepted: List[Path] = []
    rejected: List[Dict[str, str]] = []
    documents = []

    for upload in files:
        suffix = Path(upload.filename or "").suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            rejected.append(
                {"file": upload.filename or "unnamed", "reason": "unsupported type"}
            )
            continue
        if upload.size and upload.size > _MAX_UPLOAD_BYTES:
            rejected.append(
                {"file": upload.filename or "unnamed", "reason": "larger than 20 MB"}
            )
            continue

        content = await upload.read()
        if len(content) > _MAX_UPLOAD_BYTES:
            rejected.append(
                {"file": upload.filename or "unnamed", "reason": "larger than 20 MB"}
            )
            continue

        # Prefix with a short id so two uploads of "policy.pdf" never collide
        target = config.DOCUMENTS_DIR / f"{uuid.uuid4().hex[:8]}_{upload.filename}"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        accepted.append(target)

        try:
            documents.extend(load_document(target))
        except Exception as e:
            rejected.append({"file": upload.filename or "unnamed", "reason": str(e)[:120]})

    if not documents:
        raise HTTPException(
            status_code=400,
            detail=rejected[0]["reason"] if rejected
            else "No readable text found in the uploaded files.",
        )

    try:
        summary = update_index(documents)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Indexing failed")
        raise HTTPException(status_code=500, detail=f"Indexing failed: {e}")

    # BM25 index and parent lookup are stale now; force a reload on next ask
    state.reset_pipeline()

    return {
        "uploaded": [path.name for path in accepted],
        "failed": rejected,
        "added_children": summary.get("added_children"),
        "skipped_children": summary.get("skipped_children"),
    }


@router.delete("/documents")
def reset_library(confirm: str = "") -> dict:
    """
    Wipe the whole index: vector store, doc store and (when configured) the
    Pinecone namespace.

    This is deliberately destructive, so it requires `?confirm=true`. The
    uploaded source files in data/documents are kept; only the index is
    removed. The pipeline cache is invalidated so the next request rebuilds
    from an empty store and answers honestly that nothing is indexed.

    Raises:
        HTTPException 400: When the confirm flag is missing.
    """
    if confirm != "true":
        raise HTTPException(
            status_code=400,
            detail="Destructive action. Call DELETE /api/documents?confirm=true.",
        )

    try:
        clear_index()
    except Exception as e:
        logger.exception("Index reset failed")
        raise HTTPException(status_code=500, detail=f"Index reset failed: {e}")

    state.reset_pipeline()
    return {"status": "cleared"}


@router.post("/ask", response_model=AskResponse)
def ask(request: AskRequest) -> AskResponse:
    """
    Answer a question with the full pipeline in one JSON response.

    Raises:
        HTTPException 503: If the index has not been built yet.
        HTTPException 500: For unexpected pipeline failures.
    """
    try:
        pipeline = state.get_pipeline()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))

    memory = state.get_memory(request.session_id)

    try:
        return _serialize(answer(request.question, pipeline, memory))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Ask failed")
        raise HTTPException(status_code=500, detail="Pipeline error. Check server logs.")


@router.post("/ask/stream")
def ask_stream(request: AskRequest) -> StreamingResponse:
    """
    Stream a question through the pipeline as server-sent events.

    Event order:
      status  -> stages, lets the UI show progress
      sources -> citations found by retrieval
      token   -> one chunk of the answer text
      done    -> final payload (sources + debug) to close the turn

    Raises:
        HTTPException 503: If the index has not been built yet.
    """
    try:
        pipeline = state.get_pipeline()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))

    memory = state.get_memory(request.session_id)

    def generate() -> Generator[str, None, None]:
        try:
            yield _sse("status", {"stage": "retrieving"})

            queries, candidates, reranked, selected, context_text = gather_context(
                request.question, pipeline, memory
            )

            if not context_text:
                payload = no_context_response(request.question)
                yield _sse("token", {"t": payload["answer"]})
                yield _sse(
                    "done",
                    {"sources": [], "debug": payload["debug"]},
                )
                return

            yield _sse("status", {"stage": "answering"})
            yield _sse(
                "sources",
                {
                    "sources": [
                        {
                            "label": source_label(document),
                            "score": document.metadata.get("rerank_score"),
                            "preview": document.page_content[:160].strip(),
                        }
                        for document in selected
                    ]
                },
            )

            for token in stream_tokens(context_text, request.question, memory):
                yield _sse("token", {"t": token})

            yield _sse(
                "done",
                {
                    "sources": [
                        {
                            "label": source_label(document),
                            "score": document.metadata.get("rerank_score"),
                            "preview": document.page_content[:160].strip(),
                        }
                        for document in selected
                    ],
                    "debug": {
                        "original_query": request.question,
                        "generated_queries": queries,
                        "retrieved": summarise_documents(candidates),
                        "reranked": summarise_documents(reranked),
                        "final_context": summarise_documents(selected),
                    },
                },
            )
        except Exception:
            logger.exception("Stream failed")
            yield _sse("error", {"message": "Pipeline error. Check server logs."})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/history")
def delete_history(session_id: str = "default") -> dict:
    """Clear the conversation stored for one session."""
    state.clear_memory(session_id)
    return {"status": "cleared"}
