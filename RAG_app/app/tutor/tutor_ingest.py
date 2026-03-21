from __future__ import annotations

from io import BytesIO
import re
import shutil
from pathlib import Path
from pydantic import BaseModel
from pypdf import PdfReader

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings

from app.tutor.config import (
    TUTOR_FAISS_INDEX_PATH,
    TUTOR_INGEST_CHUNK_OVERLAP_CHARS,
    TUTOR_INGEST_CHUNK_SIZE_CHARS,
    TUTOR_INGEST_MAX_PAGES_PER_FILE,
)


def _normalize_text(s: str) -> str:
    s = s or ""
    s = s.replace("\x00", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def chunk_text(text: str, *, chunk_size_chars: int, overlap_chars: int) -> list[str]:
    text = text or ""
    if not text:
        return []
    if chunk_size_chars <= 0:
        return [text]
    if overlap_chars < 0:
        overlap_chars = 0
    if overlap_chars >= chunk_size_chars:
        overlap_chars = max(0, chunk_size_chars - 1)

    chunks: list[str] = []
    start = 0
    n = len(text)

    while start < n:
        end = min(start + chunk_size_chars, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = end - overlap_chars
    return chunks


def get_school_index_dir(school_id: str | int) -> Path:
    return Path(TUTOR_FAISS_INDEX_PATH) / str(school_id)


class IngestResult(BaseModel):
    school_id: str
    board: str
    class_level: str
    subject: str
    topic: str
    files_received: int
    pages_extracted: int
    chunks_indexed: int
    index_dir: str


def build_embedding_model() -> HuggingFaceEmbeddings:
    # Must match the retrieval embedding model in app/tutor/vector_store.py
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def ingest_pdfs(
    *,
    school_id: str,
    board: str,
    class_level: str,
    subject: str,
    topic: str,
    pdf_file_tuples: list[tuple[str, bytes]],
    reset_index: bool = False,
) -> IngestResult:
    index_dir = get_school_index_dir(school_id)

    if reset_index and index_dir.exists():
        shutil.rmtree(index_dir)

    embedding_model = build_embedding_model()

    docs: list[Document] = []
    pages_extracted = 0

    for filename, pdf_bytes in pdf_file_tuples:
        if not filename.lower().endswith(".pdf"):
            continue

        reader = PdfReader(BytesIO(pdf_bytes))
        # Iterate pages, extract text, then chunk each page.
        # If max pages is 0 => ingest all pages.
        if TUTOR_INGEST_MAX_PAGES_PER_FILE and TUTOR_INGEST_MAX_PAGES_PER_FILE > 0:
            max_pages = min(len(reader.pages), TUTOR_INGEST_MAX_PAGES_PER_FILE)
        else:
            max_pages = len(reader.pages)
        for page_idx in range(max_pages):
            raw_text = reader.pages[page_idx].extract_text() or ""
            raw_text = _normalize_text(raw_text)
            pages_extracted += 1

            page_chunks = chunk_text(
                raw_text,
                chunk_size_chars=TUTOR_INGEST_CHUNK_SIZE_CHARS,
                overlap_chars=TUTOR_INGEST_CHUNK_OVERLAP_CHARS,
            )

            for chunk_idx, chunk in enumerate(page_chunks):
                docs.append(
                    Document(
                        page_content=chunk,
                        metadata={
                            "school_id": school_id,
                            "board": board,
                            "class_level": class_level,
                            "subject": subject,
                            "topic": topic,
                            "source_file": filename,
                            "page": page_idx + 1,
                            "chunk_index": chunk_idx,
                        },
                    )
                )

    files_received = len(pdf_file_tuples)
    if not docs:
        # Create an empty index dir so next loads are deterministic.
        index_dir.mkdir(parents=True, exist_ok=True)
        return IngestResult(
            school_id=school_id,
            board=board,
            class_level=class_level,
            subject=subject,
            topic=topic,
            files_received=files_received,
            pages_extracted=pages_extracted,
            chunks_indexed=0,
            index_dir=str(index_dir),
        )

    if index_dir.exists() and (index_dir / "index.faiss").exists():
        vector_db = FAISS.load_local(
            str(index_dir),
            embedding_model,
            allow_dangerous_deserialization=True,
        )
        vector_db.add_documents(docs)
    else:
        index_dir.mkdir(parents=True, exist_ok=True)
        vector_db = FAISS.from_documents(docs, embedding_model)

    vector_db.save_local(str(index_dir))

    return IngestResult(
        school_id=school_id,
        board=board,
        class_level=class_level,
        subject=subject,
        topic=topic,
        files_received=files_received,
        pages_extracted=pages_extracted,
        chunks_indexed=len(docs),
        index_dir=str(index_dir),
    )

