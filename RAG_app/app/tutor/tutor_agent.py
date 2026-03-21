from __future__ import annotations

import re
from typing import Optional

from langchain_aws import ChatBedrockConverse
from langchain_core.prompts import PromptTemplate

from app.config import AWS_REGION, BEDROCK_MODEL_ID
from app.tutor.config import (
    TUTOR_MAX_CONTEXT_CHARS,
    TUTOR_MAX_TOKENS,
    TUTOR_TEMPERATURE,
)
from app.tutor.math_solver import looks_like_math, try_solve_with_sympy
from app.tutor.vector_store import (
    get_school_index_path,
    load_tutor_vector_db,
    retrieve_syllabus_chunks,
)


TUTOR_PROMPT_TEMPLATE = """You are a helpful school tutor for grades 8-10.

Student profile:
- Board: {board}
- Class: {class_level}
- Subject: {subject}
- Topic: {topic}

Conversation summary so far (may be empty):
{conversation_summary}

Syllabus excerpts (use them as the primary source; they may be incomplete):
{context}

Student question:
{question}

INSTRUCTIONS:
1. Use the syllabus excerpts to answer accurately.
2. If the question is math, provide step-by-step solution with clear reasoning and a final answer.
3. If you cannot find enough information in the excerpts, ask a brief clarifying question instead of guessing.
4. Keep language simple and student-friendly.
5. Formatting: Do NOT use LaTeX wrappers like `\\[ ... \\]` or `\\( ... \\)`.
   Do NOT use LaTeX commands like `\\text{{...}}`, `\\mathrm{{...}}`, `\\frac{{...}}{{...}}`, `\\sqrt{{...}}`, or trigonometric wrappers like `\\sin`, `\\cos`, `\\tan`, etc.
   For equations/reactions, use plain text like: `A + B -> C` and use subscripts in plain form (e.g., `C_nH_{{2n}}O`).

OUTPUT FORMAT (must match exactly):
ANSWER:
<your final tutor answer>
NEW_CONVERSATION_SUMMARY:
<a short updated summary for follow-ups; keep <= 300 characters>
"""


def _parse_answer_and_summary(text: str) -> tuple[str, str]:
    raw = (text or "").strip()

    answer_match = re.search(
        r"ANSWER:\s*(.*?)(?:\n\s*NEW_CONVERSATION_SUMMARY:|\Z)",
        raw,
        flags=re.DOTALL | re.IGNORECASE,
    )
    summary_match = re.search(
        r"NEW_CONVERSATION_SUMMARY:\s*(.*?)(?:\n\s*ANSWER:|\Z)",
        raw,
        flags=re.DOTALL | re.IGNORECASE,
    )

    answer = (answer_match.group(1).strip() if answer_match else "").strip()
    new_summary = (summary_match.group(1).strip() if summary_match else "").strip()

    if new_summary:
        new_summary = new_summary.replace('"', "").strip()[:300]

    if answer:
        return answer, new_summary
    return raw, new_summary


def get_bedrock_llm() -> ChatBedrockConverse:
    return ChatBedrockConverse(
        model_id=BEDROCK_MODEL_ID,
        region_name=AWS_REGION,
        max_tokens=TUTOR_MAX_TOKENS,
        temperature=TUTOR_TEMPERATURE,
    )


def run_tutor_agent(
    *,
    school_id: str | int,
    question: str,
    class_level: str | int,
    subject: str,
    topic: str,
    board: str,
    conversation_summary: Optional[str] = None,
) -> dict:
    vector_db = load_tutor_vector_db(school_id)
    if not vector_db:
        index_dir = get_school_index_path(school_id)
        faiss_index_path = index_dir / "index.faiss"
        if not index_dir.exists():
            answer = "Tutor knowledge base is not configured for this school yet. Please upload syllabus PDFs for this school."
        elif not faiss_index_path.exists():
            answer = (
                "Tutor knowledge base folder exists, but FAISS index files are missing. "
                "This usually means the PDFs had no extractable text (scanned book). Upload text-based PDFs "
                "or add OCR to the pipeline."
            )
        else:
            answer = (
                "Tutor knowledge base exists, but the server couldn't load it. "
                "Please re-upload the PDFs (or verify the environment for embeddings/FAISS)."
            )
        return {
            "answer": answer,
            "new_conversation_summary": conversation_summary or "",
        }

    class_str = str(class_level)
    topic_str = (topic or "").strip()

    chunks = retrieve_syllabus_chunks(
        vector_db,
        query=question,
        board=board,
        class_level=class_str,
        subject=subject,
        topic=topic_str if topic_str else None,
    )

    context_parts = []
    used_chars = 0
    for d in chunks:
        page = getattr(d, "page_content", "") or ""
        if not page:
            continue
        context_parts.append(page)
        used_chars += len(page)
        if used_chars >= TUTOR_MAX_CONTEXT_CHARS:
            break

    context = "\n\n---\n\n".join(context_parts)[:TUTOR_MAX_CONTEXT_CHARS]

    sympy_result = None
    if looks_like_math(question):
        sympy_result = try_solve_with_sympy(question)

    llm = get_bedrock_llm()
    prompt = PromptTemplate.from_template(TUTOR_PROMPT_TEMPLATE).partial(
        conversation_summary=conversation_summary or "",
    )

    # If we got SymPy output, prepend it so the LLM can explain it.
    q_for_llm = question
    if sympy_result:
        q_for_llm = f"{question}\n\n(Pre-computed math helper output):\n{sympy_result}\n"

    formatted = prompt.format(
        board=board,
        class_level=class_str,
        subject=subject,
        topic=topic_str,
        conversation_summary=conversation_summary or "",
        context=context,
        question=q_for_llm,
    )

    llm_output = llm.invoke(formatted).content
    answer, new_summary = _parse_answer_and_summary(llm_output)
    return {"answer": answer, "new_conversation_summary": new_summary}

