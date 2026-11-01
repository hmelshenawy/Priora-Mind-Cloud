import asyncio

from agentcore.langchain_agent.agent import Agent


async def main():

    agent = Agent(
        llm_model="gemma4:31b-cloud"
    )
    user_message ="What is the current time in Dubai? and suggest for me what to wear and advise and tell me what skills you have"
    history = [{"role":"user", "content": "Always call me bo2loz"}]

    async for chunk in agent.stream(
        user_message=user_message,
        history=history
    ):
        print(chunk, end="", flush=True)

    print()


asyncio.run(main())