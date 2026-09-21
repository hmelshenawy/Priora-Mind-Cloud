import os
from dotenv import load_dotenv

load_dotenv()

class Configs:
    OLLAMA_MODEL_NAME=os.getenv("OLLAMA_MODEL_NAME", "qwen3:1.7b")
    RAG_SERVICE_URL=os.getenv("RAG_SERVICE_URL", "http://127.0.0.1:8800" )
    BACKEND_SERVICE_URL=os.getenv("BACKEND_SERVICE_URL")
    ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzODE0OWQyYi00MDg2LTRkZWMtYjBmNS03NGYwOGRiZDVhOTAiLCJlbWFpbCI6ImFkbWluQGdtYWlsLmNvbSIsImlhdCI6MTc5MDAxNTkzMSwiZXhwIjoxNzkwMDI0OTMxfQ.NuXO9wGBe0sU_WarEQbxT1p_RcKfflJB9kx35atL3wg"