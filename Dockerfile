# syntax=docker/dockerfile:1

# ---------- Stage 1: build the React frontend ----------
FROM node:20-alpine AS frontend

WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Python runtime serving API + static UI ----------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# CPU-only torch wheels: plain `pip install torch` on linux pulls CUDA
# runtime (+2 GB); the cpu index is a fraction of that.
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY config.py llm_client.py ./
COPY src ./src
COPY app ./app
COPY scripts ./scripts
# Baked-in index: build_index.py must run before docker build (CI does this;
# locally run it once). Keeps the pod answering with zero in-cluster setup.
COPY vectorstore ./vectorstore

# Built UI from stage 1, served by FastAPI at /
COPY --from=frontend /fe/dist /srv/app/static

RUN useradd --create-home appuser \
    && chown -R appuser:appuser /srv
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
