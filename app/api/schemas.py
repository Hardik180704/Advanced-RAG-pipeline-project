from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    """Body for both ask endpoints."""

    question: str = Field(min_length=1, max_length=1000)
    session_id: str = Field(default="default", max_length=64)


class Source(BaseModel):
    """One retrieved parent document shown under an answer."""

    label: str
    score: float | None = None
    preview: str = ""


class DebugReport(BaseModel):
    """What happened at every pipeline step, for the debug drawer."""

    generated_queries: list[str] = []
    retrieved: list[Source] = []
    reranked: list[Source] = []
    final_context: list[Source] = []


class AskResponse(BaseModel):
    """Response of the JSON ask endpoint."""

    answer: str
    sources: list[Source]
    debug: DebugReport


class StatusResponse(BaseModel):
    """Pipeline settings surfaced in the UI sidebar."""

    status: str
    model: str
    vector_db: str
    reranker: str
