"""
Run FastAPI server. Use this if "uvicorn app.main:app" has issues on Windows.
"""
import uvicorn
import os

if __name__ == "__main__":
    # Windows: reload can cause multiprocessing/reloader instability.
    # Default to no reload unless explicitly enabled.
    reload_env = str(os.getenv("RAG_RELOAD", "false")).lower()
    reload_enabled = reload_env in ("1", "true", "yes", "y")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=reload_enabled
    )
