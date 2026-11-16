"""
Run the Memora RAG evaluation pipeline with LangSmith.

What it does:
1. Reads the gold QA pairs from `data/evaluation/rag_evals.json`.
2. (Online) Syncs them to a LangSmith dataset and runs the full RAG pipeline
   over every question, scoring each answer with two LLM judges:
     - correctness   (cot_qa): does the answer agree with the reference?
     - helpfulness   (criteria): is the answer useful and well-formed?
   Results land in the LangSmith UI, link printed at the end.
3. (Offline, `--offline`) Skips LangSmith completely and just runs the pipeline
   locally, so the wiring can be smoke-tested without an account.

Usage:
    python scripts/evaluate.py                 # full LangSmith evaluation
    python scripts/evaluate.py --limit 3       # first 3 cases only
    python scripts/evaluate.py --offline       # no LangSmith, print answers

Needs:
    - A built index (python scripts/build_index.py)
    - OPENAI_API_KEY (answers come from the real pipeline)
    - LANGSMITH_API_KEY + LANGSMITH_PROJECT (online mode only)
"""

import argparse
import json
import os
import sys
from pathlib import Path

# faiss and torch both ship their own OpenMP runtime; loading them together
# aborts on macOS unless one copy is allowed to win. Safe for eval workloads.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from langchain_core.chat_history import InMemoryChatMessageHistory
from pydantic import BaseModel, Field

EVAL_PATH = config.EVALUATION_DIR / "rag_evals.json"
DEFAULT_DATASET = "memora-rag-eval"


def load_cases() -> list[dict]:
    """Read the QA cases from the JSON evaluation file."""
    payload = json.loads(Path(EVAL_PATH).read_text(encoding="utf-8"))
    return payload["cases"]


def answer(inputs: dict) -> dict:
    """
    Target function LangSmith calls for every example.

    Each case gets a fresh memory so follow-up style references in the file do
    not leak between cases. Runs the same decomposition the streaming app uses
    (gather_context + generate_answer) so the groundedness judge receives the
    FULL text of the chunks that reached the prompt - the debug payload only
    carries 300-char previews, which would bias the judge against long chunks.

    Returns a JSON-safe map LangSmith stores and evaluators read.
    """
    from src.rag_pipeline import generate_answer, summarise_documents
    from app.stages import gather_context

    question = inputs["question"]
    queries, _, reranked, selected, context_text = gather_context(
        question, _get_pipeline(), InMemoryChatMessageHistory()
    )

    if not context_text:
        return {
            "output": (
                "I couldn't find anything relevant to your question "
                "in the indexed documents."
            ),
            "final_context": [],
            "generated_queries": queries,
        }

    output = generate_answer(question, context_text, InMemoryChatMessageHistory())
    return {
        "output": output,
        # Full chunk text for the groundedness judge (no preview truncation)
        "final_context": summarise_documents(selected, preview_chars=100_000),
        "generated_queries": queries,
    }


def run_offline(cases: list[dict], limit: int | None) -> None:
    """Run the pipeline locally and print answers and the sources used."""
    limit = limit if limit is not None else len(cases)
    print(f"Running {min(limit, len(cases))} cases offline (no scoring)...\n")

    for case in cases[:limit]:
        question = case["question"]
        print(f"Q: {question}")
        result = answer({"question": question})
        print(f"A: {result['output']}\n{'-' * 60}\n")


def run_langsmith(cases: list[dict], dataset_name: str, limit: int | None) -> None:
    """Sync the dataset to LangSmith, then evaluate with two LLM judges."""
    try:
        from langsmith import Client
        from langsmith.evaluation import evaluate
    except ImportError:
        sys.exit("langsmith is not installed. Run: pip install langsmith")

    if not os.getenv("LANGSMITH_API_KEY"):
        sys.exit(
            "LANGSMITH_API_KEY is not set.\n"
            "1. Create a free account at https://smith.langchain.com\n"
            "2. Add to .env:\n"
            "   LANGSMITH_API_KEY=lsv2_...\n"
            "   LANGSMITH_PROJECT=memora-rag-eval\n"
            "3. Or run with --offline to skip LangSmith."
        )

    client = Client()

    # Re-create the dataset so it always matches the checked-in gold set
    if client.has_dataset(dataset_name=dataset_name):
        client.delete_dataset(dataset_name=dataset_name)
    dataset = client.create_dataset(dataset_name=dataset_name)

    selected = cases if limit is None else cases[:limit]
    for case in selected:
        client.create_example(
            dataset_id=dataset.id,
            inputs={"question": case["question"]},
            outputs={"reference": case["reference"]},
        )
    print(f"Synced {len(selected)} cases to dataset '{dataset_name}'.")

    results = evaluate(
        answer,
        data=dataset_name,
        evaluators=[correctness_judge, groundedness_judge],
        client=client,
        max_concurrency=2,
    )

    print("\n--- Local preview ---")
    for row in results:
        feedback = ", ".join(
            f"{fb.key}={fb.score}" for fb in row["evaluation_results"]["results"] if fb
        )
        question = row["example"].inputs.get("question", "")[:60]
        print(f"Q: {question}")
        print(f"   {feedback or 'no feedback'}")

    url = getattr(results, "experiment_url", None)
    print(f"\nOpen the results: {url or 'check the Smith UI experiments tab'}")


# --------------------------------------------------------------------------
# LLM judges (plain-callable evaluators - no SDK version coupling)
# --------------------------------------------------------------------------

class Verdict(BaseModel):
    """Structured verdict returned by every judge call."""

    score: int = Field(description="0 = fail, 1 = partial, 2 = pass")
    reasoning: str = Field(description="One or two sentences explaining the score")


def _judge(system_prompt: str, rendered: dict) -> Verdict:
    """Call the chat model once with a structured-output verdict."""
    from langchain_core.output_parsers import PydanticOutputParser
    from langchain_core.prompts import ChatPromptTemplate
    from llm_client import get_chat_model

    parser = PydanticOutputParser(pydantic_object=Verdict)
    prompt = ChatPromptTemplate.from_messages(
        [("system", system_prompt + "\n\n{format}"), ("human", "{input}")]
    )
    chain = prompt | get_chat_model() | parser
    return chain.invoke({**rendered, "format": parser.get_format_instructions()})


def correctness_judge(inputs: dict, outputs: dict, reference_outputs: dict, **_) -> dict:
    """
    Does the produced answer agree with the gold reference?

    Scored 0 (wrong or missing the point), 1 (partially right) or
    2 (captures the reference facts) for every case in the dataset.
    """
    system = (
        "You grade a RAG chatbot's answer against a gold reference answer.\n"
        "score = 2 when the answer conveys the same facts as the reference,\n"
        "3-4 extra details are fine. score = 1 when it is partly right or\n"
        "vague. score = 0 when it contradicts the reference, is unhelpful or\n"
        "claims the documents lack the answer although the reference has it.\n"
        "Special case: when the reference itself states the answer is not in\n"
        "the documents and the answer honestly declines for the same reason,\n"
        "that is agreement - score 2."
    )
    try:
        verdict = _judge(
            system,
            {
                "input": (
                    f"Question: {inputs.get('question', '')}\n\n"
                    f"Reference: {reference_outputs.get('reference', '')}\n\n"
                    f"Answer to grade: {outputs.get('output', '')}"
                )
            },
        )
    except Exception:
        return {"key": "correctness", "score": None, "comment": "judge call failed"}

    return {"key": "correctness", "score": verdict.score, "comment": verdict.reasoning}


def groundedness_judge(outputs: dict, **_) -> dict:
    """
    Reference-free check: is the answer only making claims the retrieved
    chunks also contain, instead of inventing facts?

    The target function returns the final-context previews from the pipeline's
    debug payload, so the judge sees the exact passages that reached the
    prompt. Unanswerable cases (no chunks) score 2 when the answer declines
    to answer.
    """
    previews = [doc.get("preview", "") for doc in outputs.get("final_context", [])]
    system = (
        "You judge whether a RAG chatbot's answer is grounded in the provided\n"
        "retrieved passages. score = 2 when every factual claim in the answer\n"
        "is supported by the passages. score = 1 when minor details are\n"
        "unsupported. score = 0 when the answer invents facts or contradicts\n"
        "the passages. If no passages exist and the answer declines to answer,\n"
        "score 2."
    )
    try:
        verdict = _judge(
            system,
            {
                "input": (
                    "Retrieved passages:\n"
                    + "\n---\n".join(previews or ["(none)"])
                    + f"\n\nAnswer to grade: {outputs.get('output', '')}"
                )
            },
        )
    except Exception:
        return {"key": "groundedness", "score": None, "comment": "judge call failed"}

    return {"key": "groundedness", "score": verdict.score, "comment": verdict.reasoning}


def ensure_expected_corpus(force: bool = False) -> None:
    """
    Refuse to evaluate against an unexpected corpus.

    The gold set is grounded in the TechNova support/handbook docs. If the
    index was rebuilt around something else (a freshly uploaded resume, say),
    low scores are guaranteed and meaningless. Checked in both modes.
    """
    from src.indexing import index_summary

    files = index_summary().get("files", [])
    if force or any("technova" in name.lower() for name in files):
        return

    sys.exit(
        "The indexed corpus does not look like the TechNova evaluation docs.\n"
        f"Indexed files: {files or '(none)'}\n"
        "The gold questions assume the TechNova policies are indexed.\n"
        "Rebuild with: python scripts/build_index.py\n"
        "Or override with --force if you accept the mismatch."
    )


def _get_pipeline():
    """Import lazily so --help does not need an index to exist."""
    from app.state import get_pipeline

    return get_pipeline()


def main() -> None:
    parser = argparse.ArgumentParser(description="Memora RAG evaluation")
    parser.add_argument("--limit", type=int, default=None, help="Run only the first N cases")
    parser.add_argument("--dataset", default=DEFAULT_DATASET, help="LangSmith dataset name")
    parser.add_argument("--offline", action="store_true", help="Skip LangSmith, just run and print")
    parser.add_argument("--force", action="store_true", help="Skip the corpus check")
    args = parser.parse_args()

    if not EVAL_PATH.exists():
        sys.exit(f"Evaluation file not found: {EVAL_PATH}")

    ensure_expected_corpus(args.force)

    cases = load_cases()
    print(f"Loaded {len(cases)} eval cases from {EVAL_PATH.name}")

    if args.offline:
        run_offline(cases, args.limit)
    else:
        run_langsmith(cases, args.dataset, args.limit)


if __name__ == "__main__":
    main()
