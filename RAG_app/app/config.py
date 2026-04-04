import os
from dotenv import load_dotenv

load_dotenv(override=True)

# Database
DB_HOST = os.getenv("DB_HOST")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

# PostgreSQL schema for app tables (optional; default public). Same as backend DB_SCHEMA.
DB_SCHEMA = (os.getenv("DB_SCHEMA") or "").strip() or None

# TLS (e.g. AWS RDS) — use same bundle as Node: global-bundle.pem
# https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
DB_SSL = os.getenv("DB_SSL", "").lower() in ("true", "1", "require")
DB_SSL_CA_PATH = os.getenv("DB_SSL_CA_PATH") or os.getenv("DB_SSL_CA_FILE")
# verify-full (default) or verify-ca if hostname checks fail against RDS endpoint
DB_SSL_MODE = os.getenv("DB_SSL_MODE", "verify-full")

# AWS Bedrock (LLM)
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")