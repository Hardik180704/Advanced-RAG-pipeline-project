import json
import logging
import shutil
from typing import Dict, List, Tuple

from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore

import config
from llm_client import get_embedding_model
from src.chunking import split_documents

logger = logging.getLogger(__name__)

def _documents_to_dicts(documents: List[Document]) -> List[dict]:
    """
    Convert LangChain Documents into plain dictionaries so they can be saved.

    `json.dump` cannot write a Document object, but it happily writes
    {"page_content": "...", "metadata": {...}}.

    Args:
        documents: Documents to convert.

    Returns:
        A list of JSON-friendly dictionaries.
    """
    return [
        {"page_content": doc.page_content, "metadata": doc.metadata}
        for doc in documents
    ]

def _dicts_to_documents(items: List[dict]) -> List[Document]:
    """
    Convert dictionaries loaded from JSON back into LangChain Documents.

    This is the exact opposite of `_documents_to_dicts` and lets the rest of
    the project keep working with Document objects everywhere.

    Args:
        items: Dictionaries read from `doc_store.json`.

    Returns:
        A list of Documents.
    """
    return [
        Document(page_content = item["page_content"], metadata = item["metadata"])
        for item in items
    ]

def save_doc_store(parents: List[Document], children: List[Document]) -> None:
    """
    Write all parent and child chunks to `vectorstore/doc_store.json`.

    Keeping the chunks on disk means BM25 keyword search and parent lookup
    still work after you close and reopen the app, without re-reading and
    re-splitting every PDF.

    Args:
        parents: Large chunks used as LLM context.
        children: Small chunks that were embedded into the vector index.
    """
    config.VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)

    payload = {
        "parents": _documents_to_dicts(parents),
        "children": _documents_to_dicts(children),
    }

    config.DOC_STORE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    logger.info(
        "Saved %d parents and %d children to %s",
        len(parents),
        len(children),
        config.DOC_STORE_PATH,
    )
    

def load_doc_store() -> Tuple[List[Document], List[Document]]:
    """
    Read the parent and child chunks back from `doc_store.json`.

    Returns:
        A tuple `(parents, children)`. Both lists are empty if the index has
        never been built, which the caller treats as "nothing indexed yet".
    """
    if not config.DOC_STORE_PATH.exists():
        return [], []

    payload = json.loads(config.DOC_STORE_PATH.read_text(encoding="utf-8"))
    parents = _dicts_to_documents(payload.get("parents", []))
    children = _dicts_to_documents(payload.get("children", []))
    
    return parents, children

def create_vector_store(children: List[Document]) -> VectorStore:
    """
    Embed the child chunks and store them in the configured vector database.

    This is the only function that knows the difference between FAISS and
    Pinecone. Everywhere else in the project just calls `load_vector_store()`
    and gets back something with a `.similarity_search()` method.

    Args:
        children: The small chunks to embed.

    Returns:
        A ready-to-search LangChain vector store.

    Raises:
        ValueError: If there is nothing to index or VECTOR_DB is unknown.
    """
    if not children:
        raise ValueError(
            "There are no chunks to index. Add documents to data/documents or upload a file before building the index."
        )

    embeddings = get_embedding_model()

    if config.VECTOR_DB == "faiss":
        store = _faiss_class().from_documents(children, embeddings)
        config.FAISS_DIR.mkdir(parents=True, exist_ok=True)
        store.save_local(str(config.FAISS_DIR))
        return store
    if config.VECTOR_DB == "pinecone":
        config.check_pinecone_config()
        PineconeVectorStore = _pinecone_class()
        return PineconeVectorStore.from_documents(
            children,
            embeddings,
            index_name =  config.PINECONE_INDEX_NAME,
            namespace = config.PINECONE_NAMESPACE,
        )

    raise ValueError(
        f"Unknown VECTOR_DB '{config.VECTOR_DB}'. Please use either faiss or pinecone"
    )

def load_vector_store() -> VectorStore:
    """
    Open an index that was built earlier.

    Called every time the app answers a question, so it must not rebuild
    anything - it only reopens what is already stored.

    Returns:
        A searchable LangChain vector store.

    Raises:
        FileNotFoundError: If the FAISS index has not been built yet.
        ValueError: If VECTOR_DB is set to an unknown value.
    """
    embeddings = get_embedding_model()

    if config.VECTOR_DB == "faiss":
        if not (config.FAISS_DIR/"index.faiss").exists():
            raise FileNotFoundError(
                "No FAISS index found. Click 'Build VectorDB' in the sidebar or run: python scripts/build_index.py"
            )
        return _faiss_class().load_local(
            str(config.FAISS_DIR),
            embeddings,
            allow_dangerous_deserialization = True
        )

    if config.VECTOR_DB == "pinecone":
        config.check_pinecone_config()
        PineconeVectorStore = _pinecone_class()
        return PineconeVectorStore.from_existing_index(
            index_name = config.PINECONE_INDEX_NAME,
            embeddings = embeddings,
            namespace = config.PINECONE_NAMESPACE,
        )

    raise ValueError(f"Unknown VECTOR_DB '{config.VECTOR_DB}'. Please use either faiss or pinecone")

def _faiss_class():
    """
    Import the FAISS vector store class only when it is actually needed.

    Importing FAISS takes a moment and the library is only required when
    VECTOR_DB=faiss, so we import it inside a function instead of at the top
    of the file.

    Returns:
        The LangChain FAISS class.
    """
    from langchain_community.vectorstores import FAISS

    return FAISS

def _pinecone_class():
    """
    Import the Pinecone vector store class only when Pinecone is selected.

    FAISS users never install or import Pinecone this way, and if the package
    is missing they get a clear instruction instead of an ImportError.

    Returns:
        The LangChain PineconeVectorStore class.

    Raises:
        ImportError: If `langchain-pinecone` is not installed.
    """
    try:
        from langchain_community.vectorstores import PineconeVectorStore
        return PineconeVectorStore
    except ImportError as e:
        raise ImportError("VECTOR_DB=pinecone needs the pinecone package, do pip install it.")
