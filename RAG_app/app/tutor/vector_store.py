from __future__ import annotations

from typing import Any

from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

from app.config import AWS_REGION, BEDROCK_MODEL_ID
from app.tutor.config import TUTOR_FAISS_INDEX_PATH, TUTOR_TOP_K


def get_embedding_model() -> HuggingFaceEmbeddings:
    # Keep consistent with existing embeddings used elsewhere in this repo.
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def get_school_index_path(school_id: str | int) -> Path:
    return Path(TUTOR_FAISS_INDEX_PATH) / str(school_id)


def load_tutor_vector_db(school_id: str | int) -> FAISS | None:
    """
    Load a pre-built FAISS index containing syllabus text chunks with metadata.
    Expected metadata keys (for filtering):
      - board
      - class_level (or class)
      - subject
      - topic (optional; depends on how you ingest PDFs)
    """
    try:
        embedding_model = get_embedding_model()
        return FAISS.load_local(
            str(get_school_index_path(school_id)),
            embedding_model,
            allow_dangerous_deserialization=True,
        )
    except Exception:
        return None


def retrieve_syllabus_chunks(
    vector_db: FAISS,
    *,
    query: str,
    board: str,
    class_level: str,
    subject: str,
    topic: str | None = None,
) -> list[Any]:
    """
    Retrieve chunks and filter them by metadata to reduce irrelevant context.
    """
    k = TUTOR_TOP_K
    docs = vector_db.similarity_search(query, k=k)

    board_norm = (board or "").strip().lower()
    subject_norm = (subject or "").strip().lower()
    class_norm = (str(class_level) or "").strip().lower()
    topic_norm = (topic or "").strip().lower() if topic else ""

    def doc_meta(d: Any, key: str) -> str:
        md = getattr(d, "metadata", {}) or {}
        val = md.get(key)
        return (val if isinstance(val, str) else str(val)) if val is not None else ""

    # First-pass: board + class + subject
    scoped = []
    for d in docs:
        d_board = doc_meta(d, "board").lower()
        d_subject = doc_meta(d, "subject").lower()
        d_class = doc_meta(d, "class_level").lower() or doc_meta(d, "class").lower()

        if d_board == board_norm and d_subject == subject_norm and d_class == class_norm:
            scoped.append(d)

    # Second-pass: optional topic filtering (substring)
    if topic_norm:
        with_topic = []
        for d in scoped:
            d_topic = doc_meta(d, "topic").lower()
            if d_topic and topic_norm in d_topic:
                with_topic.append(d)
        if with_topic:
            scoped = with_topic

    return scoped[: min(len(scoped), 6)] or docs[:6]

