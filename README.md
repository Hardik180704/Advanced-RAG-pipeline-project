# Advanced RAG Pipeline

A production-grade Retrieval-Augmented Generation (RAG) system with multi-format document ingestion, hierarchical parent-child chunking, hybrid retrieval, and flexible vector store support (FAISS & Pinecone).

## Overview

This project implements an advanced RAG architecture designed to address common pitfalls in standard document QA systems:
- **Lost Context**: Small chunks give precise embeddings but lack enough surrounding context for the LLM to generate high-quality answers.
- **Diluted Retrieval**: Large chunks provide rich context but lower semantic search precision when embedded.
- **Parent-Child Solution**: We embed small child chunks for high-precision retrieval while passing their linked parent chunks to the LLM for rich, accurate context generation.

---

### Key Features
- **Multi-Format Ingestion**: Supports `.pdf`, `.docx`, and `.txt` documents with text cleaning, metadata enrichment (filename, page numbers), and automatic section heading detection.
- **Hierarchical Parent-Child Chunking**: Automatically splits documents into large parent chunks (e.g., 1600 characters) and smaller child chunks (e.g., 400 characters) linked via unique identifiers.
- **Dual Vector Store Support**:
  - **FAISS (Default)**: Runs locally with zero account setup and stores indices in `vectorstore/faiss/`.
  - **Pinecone**: Cloud vector database support for managed, distributed index storage.
- **Configurable LLM & Embeddings**: Seamless integration with OpenAI models (`gpt-4o-mini`, `text-embedding-3-small`, etc.) via LangChain.
- **Document Store Persistence**: Serializes chunk structures and parent-child lookup mappings to `vectorstore/doc_store.json` for fast reloads and incremental updates without re-processing files.
- **Incremental Indexing**: Add new documents without re-embedding existing files, avoiding duplicate embeddings and saving API credits.
- **Synthetic Data Generator**: Includes a built-in generator script for synthetic company documentation (policies, handbooks, guides) in multiple file formats.

---

## Project Structure

```
.
├── config.py                  # Central configuration & environment variables
├── llm_client.py              # Cached OpenAI LLM and embedding client initializers
├── main.py                    # Application entry point
├── requirements.txt           # Project dependencies
├── pyproject.toml             # Project metadata and configuration
├── .env.example               # Example environment variables template
├── data/
│   └── documents/             # Raw sample documents (PDF, DOCX, TXT)
├── scripts/
│   └── generate_sample_documents.py  # Synthetic document generation utility
└── src/
    ├── __init__.py
    ├── ingestion.py           # Document loaders, cleaning, metadata & section detection
    ├── chunking.py            # Recursive parent-child splitting and lookup map builder
    └── indexing.py            # Vector store indexing, persistence & lifecycle pipelines
```

---

## Getting Started

### 1. Prerequisites
- Python 3.12+
- (Optional) [uv](https://docs.astral.sh/uv/) for fast virtual environment management

### 2. Environment Setup

Clone the repository and set up a virtual environment:

```bash
git clone https://github.com/Hardik180704/Advanced-RAG-pipeline-project.git
cd Advanced-RAG-pipeline-project

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Configuration

Copy the example environment file and configure your API keys:

```bash
cp .env.example .env
```

#### Choose your Vector Database:

- **Local FAISS (Recommended for learning & local dev)**:
  ```env
  OPENAI_API_KEY=your_openai_api_key
  VECTOR_DB=faiss
  ```
- **Remote Pinecone**:
  ```env
  OPENAI_API_KEY=your_openai_api_key
  VECTOR_DB=pinecone
  PINECONE_API_KEY=your_pinecone_api_key
  PINECONE_INDEX_NAME=advanced-rag
  PINECONE_NAMESPACE=default
  ```

---

## Usage

### 1. Generate Sample Documents (Optional)

The repository comes with pre-generated sample documents in `data/documents/`. You can regenerate them at any time:

```bash
python scripts/generate_sample_documents.py
```

### 2. Ingest and Build the Index

You can build or inspect the vector index directly using the Python modules:

```python
import config
from src.ingestion import load_documents_from_folder
from src.indexing import build_index, index_summary, index_exists

# Load all documents from the data directory
documents = load_documents_from_folder(config.DOCUMENTS_DIR)
print(f"Loaded {len(documents)} document pages/sections.")

# Build parent-child index (creates vectorstore/doc_store.json and vector index)
summary = build_index(documents)
print("Index build results:", summary)

# Inspect current index contents
print("Index ready:", index_exists())
print("Summary:", index_summary())
```

### 3. Incremental Index Updates

When new documents are added, update the index without re-embedding existing files:

```python
from src.ingestion import load_document
from src.indexing import update_index

# Load newly added document
new_docs = load_document("data/documents/new_policy.pdf")

# Incrementally update index (skips already indexed chunks)
result = update_index(new_docs)
print(f"Added {result['added_children']} new chunks, skipped {result['skipped_children']} duplicates.")
```

---

## License

This project is licensed under the MIT License.
