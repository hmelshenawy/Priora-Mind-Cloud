from fastapi import FastAPI
from agentcore.config import Configs
from agentcore.schemas import ChatRequest
from agentcore.agent import Agent
from agentcore.tools.tools import tools_registery, available_tools


app = FastAPI(title="Priora AI Agent")
# ollama = OllamaClient(Configs.OLLAMA_MODEL_NAME)
agent = Agent(Configs.OLLAMA_MODEL_NAME, available_tools, tools_registery, 10)

@app.get("/health")
async def health():
    return {
        "status": "ok"
    }

@app.post("/chat")
async def chat(body: ChatRequest):
    message = body.message
    token = body.accessToken
    history = body.history
    agent.setToken(token)

    response = agent.run(message, history)
    agent.clear_history()
    return response