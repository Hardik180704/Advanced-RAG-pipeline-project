# Advanced RAG Pipeline

A production-grade Retrieval-Augmented Generation (RAG) system with multi-format document ingestion, hierarchical parent-child chunking, multi-query expansion, hybrid dense/sparse retrieval with Reciprocal Rank Fusion (RRF), and flexible vector store support (FAISS & Pinecone).

---

## Overview

Standard RAG architectures often suffer from a fundamental trade-off:
- **Lost Context**: Small chunks produce sharp embeddings for search, but lack sufficient surrounding context for the LLM to generate nuanced, accurate answers.
- **Diluted Retrieval**: Large chunks contain rich context, but their embeddings average out specific details, reducing search precision.

### The Parent-Child & Hybrid Solution
This project solves these challenges by combining:
1. **Hierarchical Parent-Child Chunking**: Small child chunks are embedded and searched for high-precision retrieval, but their linked parent chunks are recovered and supplied to the LLM for rich generation context.
2. **Hybrid Search (Dense + Sparse)**: Combines semantic vector similarity (FAISS/Pinecone) with exact keyword matching (BM25) to catch both conceptual meanings and technical identifiers (e.g., policy names, error codes).
3. **Multi-Query Rewriting**: LLM-driven query rewriting generates multiple search variants and contextualizes conversational follow-ups.
4. **Reciprocal Rank Fusion (RRF)**: Merges multiple ranked lists from various queries and search methods into a single, high-confidence candidate ranking.

---

## Key Features

- **Multi-Format Ingestion**: Supports `.pdf`, `.docx`, and `.txt` documents with text cleaning, metadata enrichment (filename, page numbers), and automatic section heading detection.
- **Hierarchical Parent-Child Chunking**: Splits documents into large parent chunks (e.g., 1600 characters) and smaller child chunks (e.g., 400 characters) linked via deterministic parent IDs.
- **Dual Vector Store Support**:
  - **FAISS (Default)**: Runs locally with zero account setup and stores indices in `vectorstore/faiss/`.
  - **Pinecone**: Cloud vector database support for managed, distributed index storage.
- **Hybrid Retrieval (Vector + BM25)**: Evaluates semantic meaning via embeddings alongside exact term matches via BM25 keyword search.
- **Reciprocal Rank Fusion (RRF)**: Fuses candidate lists using rank reciprocal scoring ($1 / (60 + \text{rank})$) to surface chunks agreed upon by multiple queries.
- **Document Store Persistence**: Serializes chunk structures and parent-child lookup mappings to `vectorstore/doc_store.json` for instant reloads without re-reading source files.
- **Incremental Indexing**: Add new documents without re-embedding the whole document library, avoiding duplicate embeddings and saving API credits.
- **CLI & Synthetic Data Generator**: Built-in scripts to generate synthetic company documentation and build/rebuild indices directly from the terminal.

---

## Project Structure

```
.
├── config.py                        # Central configuration & environment variables
├── llm_client.py                    # Cached OpenAI LLM and embedding client initializers
├── main.py                          # Application entry point
├── projectflow.txt                  # Recommended build sequence & milestone roadmap
├── requirements.txt                 # Project dependencies
├── pyproject.toml                   # Project metadata and configuration
├── .env.example                     # Example environment variables template
├── data/
│   └── documents/                   # Raw sample documents (PDF, DOCX, TXT)
├── scripts/
│   ├── build_index.py               # CLI tool to build the vector index from scratch
│   └── generate_sample_documents.py # Synthetic company document generator
└── src/
    ├── __init__.py
    ├── ingestion.py                 # Document loaders, cleaning, metadata & section detection
    ├── chunking.py                  # Parent-child splitting and lookup map builder
    ├── indexing.py                  # Vector store indexing, persistence & lifecycle pipelines
    ├── retrieval.py                 # Multi-query rewriting, BM25, vector search, RRF & hybrid retrieval
    ├── reranking.py                 # Cross-encoder & similarity reranking
    ├── refinement.py                # Context filtering & compression
    ├── memory.py                    # Conversation history management
    └── rag_pipeline.py              # End-to-end RAG orchestrator
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

The repository comes with pre-generated synthetic company documents in `data/documents/`. You can regenerate them at any time:

```bash
python scripts/generate_sample_documents.py
```

### 2. Build the Index (CLI)

Build the vector index and document store from scratch using the CLI script:

```bash
python scripts/build_index.py
```

Output:
```text
Reading documents from: .../data/documents
Index built successfully.
    Pages / documents loaded : 12
    Parent Chunks(Context)   : 20
    Child Chunks(searched)   : 83
    Vector database          : faiss
```

### 3. Hybrid Retrieval & Parent Recovery (Python)

Run queries through the hybrid multi-query retrieval pipeline:

```python
import config
from src.chunking import build_parent_lookup
from src.indexing import load_doc_store, load_vector_store
from src.retrieval import (
    build_keyword_retriever,
    generate_query_variants,
    hybrid_retrieve,
    recover_parent,
)

# 1. Load stored vector index and chunks
store = load_vector_store()
parents, children = load_doc_store()
parent_lookup = build_parent_lookup(parents)
bm25 = build_keyword_retriever(children)

# 2. Multi-query rewriting (generates variants for better coverage)
question = "What is the annual leave policy?"
queries = generate_query_variants(question)

# 3. Hybrid retrieval (Vector + BM25 combined via Reciprocal Rank Fusion)
candidate_children = hybrid_retrieve(queries, store, bm25)

# 4. Recover rich parent context for LLM generation
retrieved_parents = recover_parent(candidate_children, parent_lookup)

for idx, doc in enumerate(retrieved_parents, 1):
    print(f"\n[Parent Document {idx} - Section: {doc.metadata.get('section', 'General')}]")
    print(doc.page_content[:200] + "...")
```

### 4. Incremental Index Updates

Add new documents without re-embedding existing files:

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
