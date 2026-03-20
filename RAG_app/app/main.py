from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.sql_agent.agent import run_agent
from app.tutor.tutor_agent import run_tutor_agent
from app.tutor.tutor_ingest import ingest_pdfs

app = FastAPI(title="School RAG API", description="Text-to-SQL over school DB with role-based access")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str
    role: str = "superadmin"  # accepts: admin/superadmin (or school_admin/super_admin)
    school_id: str | int | None = None  # required when role is school_admin; can be UUID string or int
    conversation_summary: str | None = None  # rolling memory (optional)


@app.post("/ask")
def ask_question(data: AskRequest):
    """Answer a question using the school DB. Pass role and school_id for scoped results."""
    try:
        # Map app roles to internal roles used by the agent/database layer
        role = data.role.strip().lower()
        if role in ("admin", "school_admin", "schooladmin"):
            role = "school_admin"
        elif role in ("superadmin", "super_admin", "super-admin"):
            role = "super_admin"
        else:
            return {
                "question": data.question,
                "answer": "Invalid role. Use admin or superadmin.",
                "error": "invalid_role",
            }

        if role == "school_admin" and data.school_id is None:
            return {
                "question": data.question,
                "answer": "school_id is required when role is school_admin.",
                "error": "missing_school_id",
            }

        result = run_agent(
            question=data.question,
            role=role,
            school_id=data.school_id,
            conversation_summary=data.conversation_summary,
        )
        return {
            "question": data.question,
            "answer": result.get("answer", ""),
            "new_conversation_summary": result.get("new_conversation_summary", data.conversation_summary),
        }
    except Exception as e:
        print(str(e))
        if "429" in str(e) or "quota" in str(e).lower():
            return {
                "question": data.question,
                "answer": "API quota exceeded. Please try again later or upgrade your plan.",
                "error": "quota_exceeded",
            }
        return {
            "question": data.question,
            "answer": "An error occurred while processing your question.",
            "error": str(e),
        }


class TutorAskRequest(BaseModel):
    question: str
    school_id: str
    board: str
    class_level: str | int
    subject: str
    topic: str = ""
    conversation_summary: str | None = None


@app.post("/tutor/ask")
def tutor_ask(data: TutorAskRequest):
    """
    Tutor Q&A over PDF syllabus (no SQL tools). Returns:
      - answer: final tutor response
      - new_conversation_summary: updated rolling summary
    """
    try:
        result = run_tutor_agent(
            school_id=data.school_id,
            question=data.question,
            class_level=data.class_level,
            subject=data.subject,
            topic=data.topic,
            board=data.board,
            conversation_summary=data.conversation_summary,
        )
        return result
    except Exception as e:
        return {
            "answer": "Unable to process the tutor request right now. Please try again.",
            "new_conversation_summary": data.conversation_summary or "",
            "error": str(e),
        }


@app.post("/tutor/ingest")
async def tutor_ingest(
    school_id: str = Form(...),
    board: str = Form(...),
    class_level: str = Form(...),
    subject: str = Form(...),
    topic: str = Form(""),
    reset_index: str = Form("false"),
    pdf_files: list[UploadFile] = File(...),
):
    """
    Build/update a Tutor FAISS knowledge base for a given school.
    Expects multipart/form-data:
      - pdf_files: list of PDFs
      - school_id, board, class_level, subject, topic
      - reset_index: "true"/"false" (optional)
    """
    reset_enabled = str(reset_index).lower() in ("1", "true", "yes", "y")
    pdf_tuples = []
    for f in pdf_files:
        content = await f.read()
        pdf_tuples.append((f.filename or "upload.pdf", content))

    result = ingest_pdfs(
        school_id=school_id,
        board=board,
        class_level=str(class_level),
        subject=subject,
        topic=topic,
        pdf_file_tuples=pdf_tuples,
        reset_index=reset_enabled,
    )
    return result




