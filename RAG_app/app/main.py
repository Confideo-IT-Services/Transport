from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agent import run_agent

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




