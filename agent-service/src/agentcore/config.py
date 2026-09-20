import os
from dotenv import load_dotenv

load_dotenv()

class Configs:
    OLLAMA_MODEL_NAME=os.getenv("OLLAMA_MODEL_NAME", "qwen3:1.7b")