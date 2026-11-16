import logging
from typing import Dict, Generator, List, Tuple

from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser

from llm_client import get_chat_model
from src.memory import format_history
from src.rag_pipeline import ANSWER_PROMPT
from src.rag_pipeline import generate_answer, summarise_documents
from src.reranking import rerank_documents
from src.refinement import describe_source, refine_context
from src.retrieval import (
    generate_query_variants,
    hybrid_retrieve,
    recover_parents,
)

logger = logging.getLogger(__name__)


def gather_context(
    question: str,
    pipeline: Dict[str, object],
    memory: InMemoryChatMessageHistory,
) -> Tuple[List[str], List[Document], List[Document], List[Document], str]:
    """
    Run the retrieval half of the pipeline: rewrite, search, fuse, rerank.

    Splitting this from answer generation lets the streaming endpoint emit
    the sources while the LLM is still writing, and keeps one shared code
    path for both the JSON and SSE routes.

    Args:
        question: The user's question.
        pipeline: Objects from `load_pipeline()`.
        memory: Session conversation history (for query rewriting).

    Returns:
        (generated_queries, candidate_children, reranked, selected, context_text)
    """
    history_text = format_history(memory)
    queries = generate_query_variants(question, history_text)

    candidate_children = hybrid_retrieve(
        queries,
        pipeline["vector_store"],
        pipeline["keyword_retriever"],
    )
    if not candidate_children:
        return queries, [], [], [], ""

    candidate_parents = recover_parents(
        candidate_children, pipeline["parent_lookup"]
    )
    reranked = rerank_documents(question, candidate_parents)
    selected, context_text = refine_context(reranked)

    return queries, candidate_children, reranked, selected, context_text


def no_context_response(question: str) -> Dict[str, object]:
    """
    Build the answer payload used when retrieval finds nothing relevant.

    Args:
        question: The user's original question.

    Returns:
        The same shape `answer_question()` returns, without LLM call.
    """
    return {
        "answer": (
            "I couldn't find anything relevant to your question "
            "in the indexed documents."
        ),
        "sources": [],
        "debug": {
            "original_query": question,
            "generated_queries": [],
            "retrieved": [],
            "reranked": [],
            "final_context": [],
        },
    }


def answer(
    question: str,
    pipeline: Dict[str, object],
    memory: InMemoryChatMessageHistory,
) -> Dict[str, object]:
    """
    Full non-streaming pipeline, assembled from the shared stages.

    Args:
        question: The user's question.
        pipeline: Objects from `load_pipeline()`.
        memory: Session conversation history.

    Returns:
        The `answer_question()` payload shape: answer, sources, debug.
    """
    queries, candidates, reranked, selected, context_text = gather_context(
        question, pipeline, memory
    )

    if not context_text:
        return no_context_response(question)

    answer_text = generate_answer(question, context_text, memory)
    return {
        "answer": answer_text,
        "sources": selected,
        "debug": {
            "original_query": question,
            "generated_queries": queries,
            "retrieved": summarise_documents(candidates),
            "reranked": summarise_documents(reranked),
            "final_context": summarise_documents(selected),
        },
    }


def stream_tokens(context_text: str, question: str, memory: InMemoryChatMessageHistory) -> Generator[str, None, None]:
    """
    Yield answer tokens from the LLM for the SSE endpoint.

    Args:
        context_text: The formatted context produced by refinement.
        question: The user's original question.
        memory: Session conversation history.

    Yields:
        Individual answer text chunks as they are produced.
    """
    chain = ANSWER_PROMPT | get_chat_model() | StrOutputParser()

    try:
        for chunk in chain.stream(
            {
                "question": question,
                "context": context_text,
                "history": list(memory.messages),
            }
        ):
            if chunk:
                yield chunk
    except Exception as e:
        logger.error("Error generating answer: %s", e)
        yield (
            "Sorry, the OpenAI request failed. Check your API key, "
            "internet connection and usage limits."
        )


def source_label(document: Document) -> str:
    """Human-readable citation label for a document."""
    return describe_source(document)
