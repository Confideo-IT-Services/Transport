# Implementation requirements and setup

## What you need before / while implementing

### 1. Environment variables (.env)

Add these to your `.env` (in addition to your existing DB and OpenRouter vars if any):

```env
# Database (you already have these)
DB_HOST=your-mysql-host
DB_USER=admin
DB_PASSWORD=your-password
DB_NAME=schoolpulse

# AWS Bedrock (required for LLM)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
```

- **AWS credentials**: Use IAM user keys with Bedrock access, or run on EC2/ECS/Lambda with an IAM role (then you can omit `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`).
- **BEDROCK_MODEL_ID**: Default is `amazon.nova-lite-v1:0`. Other options: `anthropic.claude-3-5-sonnet-v2:0`, `anthropic.claude-3-haiku-v2:0`, etc. Ensure the model is [enabled in Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) in your account and region.

### 2. Database

- **MySQL** must be reachable from the app (host, port, user, password, database).
- **Schema**: The app discovers tables and columns from `INFORMATION_SCHEMA`. No manual schema file is required.
- **School scoping**: Tables that have a `school_id` column are treated as school-scoped. For `school_admin`, the agent is instructed to add `AND school_id = %(school_id)s` (and we inject `school_id` from the request). If some tables use a different column name (e.g. `school`), we can extend `app/database.py` to map them.

### 3. API request format

**POST /ask**

```json
{
  "question": "How many students got less than 50% in Hindi in the last exam?",
  "role": "school_admin",
  "school_id": 1,
  "conversation_summary": "Optional rolling summary for follow-ups"
}
```

- **question** (required): Natural language question.
- **role** (optional): `"school_admin"` or `"super_admin"`. Default `"super_admin"`.
- **school_id** (optional): Required when `role` is `"school_admin"`. Ignored for `super_admin`.
- **conversation_summary** (optional): Rolling summary used to support follow-up questions.

Your Node/React app should send `role` and `school_id` from the logged-in user (e.g. from JWT or session).

### 4. Tables and assumptions

We assume:

- **tests** / **test_results**: Store exam info. Typically `tests` has test metadata (e.g. date, subject or link to `test_subjects`), and `test_results` has per-student marks (e.g. `student_id`, marks/percentage). The agent uses the schema to write the right JOINs.
- **students**: Has `school_id` (or is linked to school via `student_enrollments` / `classes`). If your schema uses a different path (e.g. student → class → school), the generated SQL may need tuning; you can add short hints in the prompt or extend the schema description.
- **subjects**: Likely has subject names (e.g. "Hindi"). The agent will JOIN to `test_results` / `test_subjects` based on schema.

If any table does **not** have `school_id` but is school-scoped via a foreign key (e.g. only through `students.school_id`), the LLM will need to JOIN through that path. The prompt instructs it to restrict by school for school_admin; for complex schemas you may want to add a one-line “hint” in the schema string in `get_schema()`.

### 5. Optional: HuggingFace + FAISS

- **Embeddings**: HuggingFace `sentence-transformers/all-MiniLM-L6-v2` runs **locally** (no API key). Used if you later add RAG over documents.
- **FAISS**: Local vector store under `data/faiss_index`. The current **/ask** endpoint uses only the Text-to-SQL agent (Bedrock + schema + execute_sql). If you add a doc-RAG flow later, you can use the existing `vector_store` and `rag_chain` for that path.

### 6. Running the app

**Option A – from project root (recommended on Windows to avoid reload issues):**
```bash
cd F:\RAG_Project
python run_server.py
```

**Option B – with uvicorn directly:**
```bash
cd F:\RAG_Project
# Windows: use without --reload to avoid multiprocessing errors
uvicorn app.main:app --host 0.0.0.0 --port 8000
# Linux/Mac: you can add --reload for auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open **http://localhost:8000/docs** in your browser for Swagger UI, or call **POST http://localhost:8000/ask** with the JSON body above.

### Response
- `answer`: Assistant response (may include a Markdown table)
- `new_conversation_summary`: Updated rolling summary for the next turn

---

## Summary

| Requirement | Status |
|-------------|--------|
| `.env` with DB_* and AWS_* (or IAM role) | You provide |
| Bedrock model enabled in AWS console | You enable |
| MySQL reachable and schema with expected tables | You provide |
| `role` + `school_id` from your auth in Node/React | You pass in `/ask` |
| HuggingFace/FAISS (for future doc RAG) | Already in project, optional for current flow |
