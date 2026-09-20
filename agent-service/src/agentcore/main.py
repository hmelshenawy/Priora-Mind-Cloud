from fastapi import FastAPI, Request
from agentcore.llm import OllamaClient
from agentcore.config import Configs
from agentcore.schemas import ChatRequest


app = FastAPI(title="Priora AI Agent")
ollama = OllamaClient(Configs.OLLAMA_MODEL_NAME)

@app.get("/health")
async def health():
    return {
        "status": "ok"
    }

@app.post("/chat")
async def chat(body: ChatRequest):
    message = body.message

    response = ollama.chat(message=message)
    return response