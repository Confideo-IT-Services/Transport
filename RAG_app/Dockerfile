# Build from this directory: docker build -t allpulse/rag .
# Context: RAG_app/ (contains app/, requirements.txt, run_server.py)

FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Env (DB_*, AWS_*, BEDROCK_*, etc.) from ECS task / secrets — not baked into the image
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
