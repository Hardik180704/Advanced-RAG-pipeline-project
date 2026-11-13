# Advanced RAG Pipeline

A production-grade Retrieval-Augmented Generation (RAG) system with multi-format document ingestion, hierarchical parent-child chunking, hybrid retrieval, and vector store support (FAISS & Pinecone).

## Overview

This project implements an advanced RAG architecture designed to solve common challenges in document QA and semantic search, including lost context in small chunks and diluted retrieval accuracy in large chunks.

### Key Features
- **Multi-Format Ingestion**: Supports `.pdf`, `.docx`, and `.txt` documents with text cleaning, metadata enrichment, and automatic section heading detection.
- **Hierarchical Parent-Child Chunking**: Chunks documents into large parent contexts (for LLM generation) linked to smaller child chunks (for precise embedding and retrieval).
- **Flexible Vector Storage**: Built-in support for local FAISS vector indices or managed Pinecone databases.
- **Configurable LLM & Embeddings**: Seamless integration with OpenAI models (`gpt-4o-mini`, `text-embedding-3-small`, etc.) via LangChain.
- **Sample Document Generator**: Built-in generation script for synthetic company documentation (policies, handbooks, guides) in multiple file formats.

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
    └── indexing.py            # Vector store indexing and retrieval pipelines
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

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your OpenAI API key and desired settings:
```env
OPENAI_API_KEY=your_api_key_here
VECTOR_DB=faiss
```

### 4. Generate Sample Documents (Optional)

The sample documents in `data/documents/` are pre-generated. If you need to re-generate them:
```bash
python scripts/generate_sample_documents.py
```

### 5. Running the Pipeline

Execute the main application:
```bash
python main.py
```
