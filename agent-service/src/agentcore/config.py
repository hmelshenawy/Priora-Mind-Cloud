import os
from dotenv import load_dotenv

load_dotenv()

class Configs:
    OLLAMA_MODEL_NAME=os.getenv("OLLAMA_MODEL_NAME", "qwen3:1.7b")
    RAG_SERVICE_URL=os.getenv("RAG_SERVICE_URL", "http://127.0.0.1:8800/api/v1" )
    BACKEND_SERVICE_URL=os.getenv("BACKEND_SERVICE_URL")
    ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzODE0OWQyYi00MDg2LTRkZWMtYjBmNS03NGYwOGRiZDVhOTAiLCJlbWFpbCI6ImFkbWluQGdtYWlsLmNvbSIsImlhdCI6MTc5MDE4NTA0MCwiZXhwIjoxNzkwMTk0MDQwfQ.cMZ9YfnO89rqnNFeT0hqtQUr3-pd-0yuQkxboxuZyZo"