from fastapi import FastAPI, Depends, Request
from agentcore.config import Configs
from agentcore.schemas import ChatRequest
# from agentcore.agent import Agent, OrchAgent
from agentcore.langchain_agent.agent import Agent
from  agentcore.utils.service_verfication import verify_service_key
from agentcore.skills.skill_loader import UserSkillProvider, BuildinSkillProvider , SkillManager
from agentcore.tools.tools import tools_registery, available_tools
from agentcore.context import access_token, mindSpaceId
from fastapi.responses import StreamingResponse
import logging
import asyncio
from time import perf_counter
from uuid import uuid4
import re
from agentcore.memory.memory import RequestLogger, request_id

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s:%(message)s",
    force=True,
)

logging.getLogger("agentcore").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = RequestLogger(logging.getLogger(__name__), {})

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

# agent = Agent(Configs.OLLAMA_MODEL_NAME,tools= available_tools,tool_registry= tools_registery,skills= skill_manager,steps= 10)
agent = Agent(Configs.OLLAMA_MODEL_NAME, skills= skill_manager)


@app.get("/health")
async def health():
    return {
        "status": "ok"
    }

@app.post("/chat", dependencies=[Depends(verify_service_key)])
async def chat(body: ChatRequest, request: Request):
    message = body.message
    token = body.accessToken
    history = [item.model_dump() for item in body.history]
    mindSpace = str(body.mindSpaceId)

    
    supplied = request.headers.getlist("x-request-id")
    correlation = supplied[0] if len(supplied) == 1 and re.fullmatch(r"[A-Za-z0-9_-]{1,64}", supplied[0]) and supplied[0] != "-" else uuid4().hex

    async def generate():
        request_ctx = request_id.set(correlation)
        token_ctx = access_token.set(token)
        mindSpace_ctx = mindSpaceId.set(mindSpace)
        started = perf_counter()
        outcome = "cancelled"
        output_chars = 0
        logger.debug("chat.started history_count=%d", len(history))
        try:
            # Console hygiene must not leave nested content-bearing traces enabled.
            # Background extraction tasks inherit this request-local context.
            
            async for chunk in agent.stream(message, history):
                output_chars += len(chunk)
                yield chunk
            outcome = "completed"
        except (asyncio.CancelledError, GeneratorExit):
            raise
        except Exception:
            outcome = "failed"
            logger.error("chat.failed error_code=chat_execution_failed")
            raise
        finally:
            logger.info("chat.finished outcome=%s duration_ms=%d output_chars=%d",
                        outcome, (perf_counter() - started) * 1000, output_chars)
            access_token.reset(token_ctx)
            mindSpaceId.reset(mindSpace_ctx)
            request_id.reset(request_ctx)

    return StreamingResponse(
        generate(),
        media_type="text/plain"
    )
