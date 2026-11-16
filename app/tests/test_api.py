import os

os.environ.setdefault("OPENAI_API_KEY", "test-key")


import pytest
from fastapi.testclient import TestClient

from app import state
from app.api import routes
from app.main import app


@pytest.fixture(scope="function")
def client(monkeypatch) -> TestClient:
    """Test client with the pipeline faked, so no index is needed."""
    class FakeChain:
        def predict(self, pairs):
            return [0.0 for _ in pairs]

    def fake_pipeline():
        return {
            "vector_store": object(),
            "keyword_retriever": object(),
            "parent_lookup": {},
        }

    monkeypatch.setattr(state, "get_pipeline", fake_pipeline)
    state.clear_memory("test-session")
    return TestClient(app)


def test_health(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_status(client: TestClient):
    response = client.get("/api/status")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "vector_db" in body


def test_ask_with_empty_store_returns_not_found_answer(client: TestClient):
    response = client.post(
        "/api/ask",
        json={"question": "What is the policy?", "session_id": "test-session"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "couldn't find anything relevant" in body["answer"]
    assert body["sources"] == []


def test_ask_rejects_empty_question(client: TestClient):
    response = client.post(
        "/api/ask",
        json={"question": "", "session_id": "test-session"},
    )
    assert response.status_code == 422


def test_history_clear(client: TestClient):
    response = client.delete("/api/history?session_id=test-session")
    assert response.status_code == 200
    assert response.json() == {"status": "cleared"}


def test_documents_summary_shape(client: TestClient):
    response = client.get("/api/documents")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"parents", "children", "files"}
    assert isinstance(body["files"], list)


def test_upload_rejects_unsupported_type(client: TestClient):
    response = client.post(
        "/api/documents",
        files={"files": ("malware.exe", b"binary", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "unsupported type" in response.json()["detail"]


def test_reset_library_requires_confirm(client: TestClient):
    response = client.delete("/api/documents")
    assert response.status_code == 400
    assert "confirm=true" in response.json()["detail"]


def test_reset_library_clears(client: TestClient, monkeypatch):
    called = []
    monkeypatch.setattr(routes, "clear_index", lambda: called.append(True))
    response = client.delete("/api/documents?confirm=true")
    assert response.status_code == 200
    assert response.json() == {"status": "cleared"}
    assert called == [True]
