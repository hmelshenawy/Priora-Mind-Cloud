from fastapi import FastAPI, Request
from agentcore.llm import OllamaClient
from agentcore.config import Configs
from agentcore.schemas import ChatRequest
from agentcore.agent import Agent
from agentcore.tools import tools_registery, registered_tools


app = FastAPI(title="Priora AI Agent")
# ollama = OllamaClient(Configs.OLLAMA_MODEL_NAME)
agent = Agent(Configs.OLLAMA_MODEL_NAME, registered_tools, tools_registery, 10)

@app.get("/health")
async def health():
    return {
        "status": "ok"
    }

@app.post("/chat")
async def chat(body: ChatRequest):
    message = body.message

    response = agent.run(message)
    agent.clear_history()
    return response