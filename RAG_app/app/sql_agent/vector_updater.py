import time

from app.sql_agent.vector_store import build_vector_db


def start_vector_updater():
    while True:
        print("Updating vector database...")
        build_vector_db()
        print("Vector database updated")
        time.sleep(21600)  # 6 hours

