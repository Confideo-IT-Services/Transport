
from langchain_openai import ChatOpenAI
from langchain_classic.chains import RetrievalQA
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from app.config import OPENROUTER_API_KEY
from app.vector_store import build_vector_db

embedding_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

try:
    vector_db = FAISS.load_local(
        "data/faiss_index",
        embedding_model,
        allow_dangerous_deserialization=True
    )
except RuntimeError:
    print("FAISS index not found, building vector database...")
    build_vector_db()
    vector_db = FAISS.load_local(
        "data/faiss_index",
        embedding_model,
        allow_dangerous_deserialization=True
    )

try:
    llm = ChatOpenAI(
        model="google/gemini-2.5-flash", 
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        max_tokens=2000
    )
except Exception as e:
    print(f"Error initializing LLM: {e}")
    llm = None

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vector_db.as_retriever()
)