import os
from dotenv import load_dotenv

load_dotenv()

class Configs:
    TIMEZONE=os.getenv("TIMEZONE","Asia/Dubai")
    OLLAMA_MODEL_NAME=os.getenv("OLLAMA_MODEL_NAME", "qwen3:1.7b")
    OLLAMA_API_KEY=os.getenv("OLLAMA_API_KEY")
    RAG_SERVICE_URL=os.getenv("RAG_SERVICE_URL", "http://127.0.0.1:8800/api/v1" )
    BACKEND_SERVICE_URL=os.getenv("BACKEND_SERVICE_URL")
    RAG_SECRET_KEY = os.environ["RAG_SECRET_KEY"]
    CHECKPOINT_DATABASE_URL=os.environ["CHECKPOINT_DATABASE_URL"]
    OPENROUTER_API_KEY=os.environ["OPENROUTER_API_KEY"]
    OPENROUTER_MODEL=os.environ["OPENROUTER_MODEL"]