import os
from pathlib import Path

# Base path for FAISS indexes.
# We store one FAISS directory per school at:
#   {TUTOR_FAISS_INDEX_PATH}/{school_id}/
# Use absolute default so ingestion + retrieval don't depend on the process cwd.
_DEFAULT_TUTOR_INDEX_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "tutor_faiss_index"
)
TUTOR_FAISS_INDEX_PATH = os.getenv(
    "TUTOR_FAISS_INDEX_PATH",
    str(_DEFAULT_TUTOR_INDEX_PATH),
)
TUTOR_TOP_K = int(os.getenv("TUTOR_TOP_K", "8"))

# LLM settings
TUTOR_MAX_CONTEXT_CHARS = int(os.getenv("TUTOR_MAX_CONTEXT_CHARS", "6000"))
TUTOR_MAX_TOKENS = int(os.getenv("TUTOR_MAX_TOKENS", "900"))
TUTOR_TEMPERATURE = float(os.getenv("TUTOR_TEMPERATURE", "0"))

# Ingestion/chunking
TUTOR_INGEST_CHUNK_SIZE_CHARS = int(os.getenv("TUTOR_INGEST_CHUNK_SIZE_CHARS", "1500"))
TUTOR_INGEST_CHUNK_OVERLAP_CHARS = int(os.getenv("TUTOR_INGEST_CHUNK_OVERLAP_CHARS", "200"))
# Max pages per PDF file.
# Set to 0 (default) to ingest all pages in each uploaded PDF.
TUTOR_INGEST_MAX_PAGES_PER_FILE = int(os.getenv("TUTOR_INGEST_MAX_PAGES_PER_FILE", "0"))

