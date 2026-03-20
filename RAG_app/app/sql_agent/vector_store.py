from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

from app.sql_agent.database import fetch_table_data

embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def build_vector_db():
    documents = fetch_table_data()

    print(len(documents))
    if not documents:
        raise ValueError("No documents found in the database. Please add data to the tables.")

    index_path = Path("data/faiss_index")

    # If a file exists where we expect a directory, remove it so we can create the folder.
    if index_path.exists() and index_path.is_file():
        index_path.unlink()

    index_path.mkdir(parents=True, exist_ok=True)

    vector_db = FAISS.from_texts(documents, embedding_model)
    vector_db.save_local(str(index_path))


build_vector_db()

