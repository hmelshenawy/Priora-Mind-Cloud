import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from langsmith import Client

from agentcore.config import Configs
from agentcore.context import mindSpaceId, access_token
from agentcore.langchain_agent.agent import Agent
from agentcore.langchain_agent.tools import langchain_tools
from agentcore.skills.skill_loader import (
    UserSkillProvider,
    BuildinSkillProvider,
    SkillManager,
)
from agentcore.tools.tools import available_tools, tools_registery


ROOT = Path(__file__).resolve().parents[3]

load_dotenv(ROOT / ".env", override=True)
load_dotenv(ROOT / ".env.eval", override=True)

DATASET_NAME = "priora-agent-tool-selection-v1"


def exact_tool_match(outputs: dict, reference_outputs: dict) -> bool:
    expected = set(reference_outputs["expected_tools"])
    actual = set(outputs["called_tools"])

    return expected == actual


async def main():

    skill_manager = SkillManager(
        BuildinSkillProvider(),
        UserSkillProvider(),
        available_tools,
        tools_registery,
    )

    agent = Agent(
        Configs.OLLAMA_MODEL_NAME,
        skills=skill_manager,
    )

    async def run_agent(inputs: dict) -> dict:

        messages = agent._build_messages(
            user_message=inputs["input"],
            history=[],
            memories=[],
        )

        result = await agent.agent.ainvoke({
            "messages": messages
        })

        called_tools = [
            call["name"]
            for message in result["messages"]
            for call in getattr(message, "tool_calls", [])
        ]

        return {"called_tools": called_tools}

    mindspace_token = mindSpaceId.set(
        os.environ["EVAL_MINDSPACE_ID"]
    )
    jwt_token = access_token.set(
        os.environ["EVAL_JWT"]
    )

    try:
        client = Client()

        await client.aevaluate(
            run_agent,
            data=DATASET_NAME,
            evaluators=[exact_tool_match],
            experiment_prefix="priora-agent-tool-selection",
            max_concurrency=1,
            metadata={
                "models": [Configs.OLLAMA_MODEL_NAME],
                "eval_type": "tool_selection",
            },
        )

    finally:
        mindSpaceId.reset(mindspace_token)
        access_token.reset(jwt_token)


if __name__ == "__main__":
    asyncio.run(main())