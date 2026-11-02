import asyncio
from agentcore.evals.report import save_report
from agentcore.evals.dataset import TEST_CASES
from agentcore.langchain_agent.agent import Agent
from agentcore.tools.tools import tools_registery, available_tools
from langchain_core.messages import ToolMessage
from agentcore.config import Configs
from agentcore.langchain_agent.agent import Agent
from agentcore.skills.skill_loader import UserSkillProvider, BuildinSkillProvider , SkillManager
from agentcore.context import mindSpaceId, access_token

import os
from dotenv import load_dotenv

load_dotenv(".env.eval")

TEST_JWT = os.environ["EVAL_JWT"]
TEST_MINDSPACE_ID = os.environ["EVAL_MINDSPACE_ID"]


async def evaluate_agent(agent: Agent):

    results = []


    for case in TEST_CASES:

        messages = agent._build_messages(
        user_message=case["input"],
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

        tool_calls = [
        {
            "name": call["name"],
            "args": call["args"],
        }
        for message in result["messages"]
        for call in getattr(message, "tool_calls", [])
        ]

        tool_results = [
    {
        "tool": message.name,
        "status": message.status,
        "content": str(message.content)[:300],
    }
    for message in result["messages"]
    if isinstance(message, ToolMessage)
    ]

        expected = set(case["expected_tools"])
        actual = set(called_tools)

        passed = expected == actual

        results.append({
            "input": case["input"],
            "expected_tools": sorted(expected),
            "called_tools": called_tools,
            "tool_calls": tool_calls,
            "tool_results": tool_results,
            "passed": passed,
        })

    return results


async def main():

    builtin_provider = BuildinSkillProvider()
    user_provider = UserSkillProvider()

    skill_manager = SkillManager(
        builtin_provider,
        user_provider,
        available_tools,
        tools_registery
    )

    agent = Agent(Configs.OLLAMA_MODEL_NAME, skills= skill_manager)
    token1 = mindSpaceId.set(TEST_MINDSPACE_ID)
    token2 = access_token.set(TEST_JWT)

    identifier = "user:cf644fc3-8dc4-4e6b-a670-b017275fe2ec"

    # try:
    #     result = skill_manager.load_skill(identifier)
    #     print("SKILL LOAD STATUS: SUCCESS")
    #     print("SKILL CONTENT LENGTH:", len(result))
    # except Exception as exc:
    #     print("SKILL LOAD STATUS: FAILED")
    #     print("ERROR TYPE:", type(exc).__name__)
    
    try:
        results = await evaluate_agent(agent)
    finally:
        mindSpaceId.reset(token1)
        access_token.reset(token2)

    report = save_report(
        results,
        Configs.OLLAMA_MODEL_NAME,
    )

    for result in results:
        print(result)

    print(f"\nAccuracy: {report['accuracy']:.1%}")


if __name__ == "__main__":
    asyncio.run(main())