from fastapi import FastAPI
from agentcore.config import Configs
from agentcore.schemas import ChatRequest
from agentcore.agent import Agent
from agentcore.tools.tools import tools_registery, available_tools
from agentcore.context import access_token, mindSpaceId

app = FastAPI(title="Priora AI Agent")
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
    mindSpace = body.mindSpaceId

    token_ctx = access_token.set(token)
    mindSpace_ctx = mindSpaceId.set(mindSpace)
    try:
        response = agent.run(message, history)
        return response
    finally:
        access_token.reset(token_ctx)
        mindSpaceId.reset(mindSpace_ctx)