from fastapi import FastAPI
from agentcore.config import Configs
from agentcore.schemas import ChatRequest
from agentcore.agent import Agent, OrchAgent
from agentcore.skills.skill_loader import UserSkillProvider, BuildinSkillProvider , SkillManager
from agentcore.tools.tools import tools_registery, available_tools
from agentcore.context import access_token, mindSpaceId
from fastapi.responses import StreamingResponse


app = FastAPI(title="Priora AI Agent")
# skills = BuildinSkillProvider(available_tools, tools_registery).list()

builtin_provider = BuildinSkillProvider()
user_provider = UserSkillProvider()

skill_manager = SkillManager(
    builtin_provider,
    user_provider,
    available_tools,
    tools_registery
)

agent = Agent(Configs.OLLAMA_MODEL_NAME,tools= available_tools,tool_registry= tools_registery,skills= skill_manager,steps= 10)



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

    
    async def generate():
        token_ctx = access_token.set(token)
        mindSpace_ctx = mindSpaceId.set(mindSpace)
        print("USER SKILLS:", skill_manager.user.list())
        print("REGISTERED:", "load_skill" in tools_registery)
        try:
            async for chunk in agent.stream(message, history):
                yield chunk
        finally:
            access_token.reset(token_ctx)
            mindSpaceId.reset(mindSpace_ctx)

    return StreamingResponse(
        generate(),
        media_type="text/plain"
    )