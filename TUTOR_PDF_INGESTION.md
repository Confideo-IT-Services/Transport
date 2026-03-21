# Tutor PDF Ingestion (Super Admin)

This document explains how Tutor PDF ingestion works end-to-end:

- You upload syllabus PDFs from **Super Admin**
- The backend forwards them to **RAG_app** (FastAPI)
- RAG_app extracts text from PDFs, chunks it, tags metadata, and builds a **FAISS** index
- Tutor Q&A later retrieves the most relevant chunks using the same metadata convention

## 1. Prerequisites

1. Your DB must have `schools.board`.
   - If your DB already exists and you only updated code, you also need to run the SQL migration:
     - `backend/sql/add_schools_board_column.sql`
2. Ensure the RAG service is running (default `RAG_API_URL`):
   - `RAG_app` FastAPI should be reachable at `http://localhost:8000`
3. (Optional but recommended) Increase proxy timeout for large books:
   - ConventPulse uses `axios` with env var `RAG_API_TIMEOUT_MS`
   - Default is now 15 minutes for tutor ingestion; you can override:
     - `RAG_API_TIMEOUT_MS=900000` (15 minutes) or higher
3. FAISS indexes will be written under:
   - `RAG_app/data/tutor_faiss_index/{school_id}/`

## 2. Upload API (recommended for Super Admin)

### Endpoint (ConventPulse backend)

`POST /api/tutor/ingest`

Authorization:
- Requires a valid JWT token for `superadmin`

This endpoint expects `multipart/form-data`.

### Form fields

Required:
- `schoolId` (string)
- `classLevel` (string or number; e.g., `8`, `9`, `10`)
- `subject` (string; e.g., `Mathematics`, `Physics`, `Biology`, `Social Studies`, `English`)
- `topic` (string; optional)
  - Leave it blank for whole-book ingestion
  - Empty topic means Tutor retrieval will NOT filter by topic
- `pdfFiles` (repeatable file field; multiple PDFs allowed)

Optional:
- `resetIndex` (string; `"true"`/`"false"`). Default is `"false"`.
  - If `"true"`, RAG_app deletes the existing FAISS index folder for that `schoolId` and rebuilds from scratch.

### File field

- Field name: `pdfFiles`
- File type: PDF (`application/pdf`)

### Example (Postman)

1. Method: `POST`
2. URL: `http://localhost:<CONVENTPULSE_PORT>/api/tutor/ingest`
3. Headers:
   - `Authorization: Bearer <your_superadmin_jwt>`
4. Body:
   - `form-data`
   - Add keys:
     - `schoolId` = `<uuid>`
     - `classLevel` = `9`
     - `subject` = `Mathematics`
     - `topic` = `Quadratic Equations`
     - `resetIndex` = `true`
     - `pdfFiles` = (choose one or more PDF files; set type to `File` and repeat the key for multiple PDFs)

Expected response (shape):
- stats about pages/chunks indexed and which FAISS directory was updated.

## 2.1 Upload via UI (now available)

Open the Super Admin page:
- `/superadmin/tutor-ingestion`

Fill:
- `School` (board is auto-read from that school; you do not manually select board)
- `Class`
- `Subject`
- `Topic` (optional)
- select one or more `PDF files`
- optional `Reset existing FAISS index for this school`

Then click:
- `Upload PDFs & Build Tutor KB`

## 3. What RAG_app does with the uploaded PDFs

### Endpoint in RAG_app

`POST /tutor/ingest` (multipart/form-data)

RAG_app receives:
- `school_id`
- `board` (derived from `schools.board`)
- `class_level`
- `subject`
- `topic` (can be empty)
- `pdf_files` (list of uploaded PDFs)
- `reset_index`

### Text extraction

- Each PDF is read using `pypdf`
- For each page:
  - text is extracted via `page.extract_text()`
  - whitespace is normalized

### Chunking rules (per page)

RAG_app splits each extracted page into overlapping character chunks:

- Chunk size (default): `1500` chars  
  - env: `TUTOR_INGEST_CHUNK_SIZE_CHARS`
- Overlap (default): `200` chars  
  - env: `TUTOR_INGEST_CHUNK_OVERLAP_CHARS`
- Max pages per file (default): `200`  
  - env: `TUTOR_INGEST_MAX_PAGES_PER_FILE`

Note: for “whole book” uploads we changed the default to ingest **all pages**:
- `TUTOR_INGEST_MAX_PAGES_PER_FILE=0` (default)

So:
- Every chunk is aligned to a page range (chunking happens inside a page)
- Each chunk inherits metadata for:
  - `school_id`, `board`, `class_level`, `subject`, `topic`
  - plus `page` and `chunk_index`

### Metadata tagging convention

Each chunk stored in FAISS includes the following metadata keys:
- `school_id`
- `board`
- `class_level`
- `subject`
- `topic`
- `source_file` (original PDF filename)
- `page` (1-indexed page number)
- `chunk_index` (0-based within the page)

This is the “class/subject/topic metadata convention” used later during retrieval.

## 4. How the FAISS index is stored/updated

For each `school_id`, RAG_app uses a dedicated FAISS folder:

- `RAG_app/data/tutor_faiss_index/{school_id}/`

Update behavior:
- If the index folder exists, RAG_app loads it and **appends** new chunk vectors.
- If `resetIndex=true`, RAG_app deletes the folder and rebuilds the index from the uploaded PDFs.

## 5. How Tutor Q&A uses this knowledge base

When a `teacher` or `parent` asks:

1. ConventPulse backend reads the school’s fixed `board` from `schools.board`
2. It calls `RAG_app`:
   - includes `school_id`, `board`, `class_level`, `subject`, `topic`
3. RAG_app:
   - loads the per-school FAISS index
   - filters chunks by matching metadata:
     - `board`, `class_level`, `subject`
     - and `topic` only if `topic` is non-empty (substring match)

So for whole-book ingestion, leave `topic` empty; Tutor answers will come from any chunk within the uploaded book (still scoped by board/class/subject).

