"""Synthetic execution through real LangChain graphs; no external services."""
import asyncio
import re
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import tool

from agentcore.langchain_agent.agent import Agent, ExecutionLogs
from agentcore.memory.memory import request_id
from agentcore.context import access_token
from agentcore.schemas import ChatRequest, MemoryResponse
from agentcore.skills.skill_loader import SkillManager
from agentcore import main
from starlette.requests import Request


SECRET = "PRIVATE_CONTENT_https://secret.invalid_credential"


class SyntheticModel(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


class ExecutionLoggingTests(unittest.IsolatedAsyncioTestCase):
    def make_agent(self, responses, tools=()):
        model = SyntheticModel(responses=responses)
        llm = SimpleNamespace(get_model=lambda: model)
        builtin = Mock()
        builtin.list.return_value = []
        builtin.load_skill.side_effect = lambda name: (
            f"Skill '{name}' not found" if name == "missing" else SECRET
        )
        user = Mock()
        user.list.return_value = []
        user.load_skill.return_value = SECRET
        skills = SkillManager(builtin, user, [], {})
        with patch("agentcore.langchain_agent.agent.LangChainOllama", return_value=llm), \
             patch("agentcore.langchain_agent.agent.langchain_tools", list(tools)):
            agent = Agent("synthetic", skills)
        agent.memory.retrieve = AsyncMock(return_value=[])
        agent.events_memory.retrieve = AsyncMock(return_value=[])
        return agent

    async def test_multistep_tools_and_skills(self):
        @tool
        def synthetic(value: str) -> str:
            """Return a synthetic private result."""
            return SECRET

        agent = self.make_agent([
            AIMessage(content="", tool_calls=[
                {"name": "synthetic", "args": {"value": SECRET}, "id": "one"},
                {"name": "load_skill", "args": {"identifier": "builtin:sample"}, "id": "two"},
            ]),
            AIMessage(content="", tool_calls=[
                {"name": "load_skill", "args": {"identifier": "user:sample"}, "id": "three"},
            ]),
            AIMessage(content=SECRET),
        ], [synthetic])
        token = request_id.set("multi-step")
        try:
            with self.assertLogs("agentcore", level="DEBUG") as captured:
                result = await agent.run(SECRET)
        finally:
            request_id.reset(token)
        self.assertEqual(result, SECRET)
        logs = "\n".join(captured.output)
        self.assertNotIn(SECRET, logs)
        self.assertTrue(all("request_id=multi-step " in line for line in captured.output))
        self.assertEqual(logs.count("model.started"), 3)
        self.assertEqual(logs.count("model.completed"), 3)
        self.assertEqual(logs.count("tool.started"), 3)
        self.assertEqual(logs.count("tool.completed"), 3)
        self.assertEqual(logs.count("skill.load.completed"), 2)
        for step, count in [(1, 2), (2, 1), (3, 0)]:
            self.assertRegex(logs, rf"model.completed stage=chat step={step} duration_ms=\d+ tool_call_count={count}")
        for source in ("builtin", "user"):
            self.assertIn(f"source={source} status=success", logs)

    async def test_skill_failures_and_tool_exception(self):
        agent = self.make_agent([AIMessage(content="unused")])
        load = agent.tools[-1]
        token = request_id.set("failures")
        try:
            with self.assertLogs("agentcore", level="DEBUG") as captured:
                callbacks = {"callbacks": [ExecutionLogs(["load_skill"])]}
                await load.ainvoke({"identifier": "builtin:missing"}, config=callbacks)
                await load.ainvoke({"identifier": "other:" + SECRET}, config=callbacks)
                agent.skills.user.load_skill.side_effect = RuntimeError(SECRET)
                with self.assertRaises(RuntimeError):
                    await load.ainvoke({"identifier": "user:" + SECRET}, config=callbacks)
                with self.assertRaises(ValueError):
                    await load.ainvoke({"identifier": "malformed-private-identifier"}, config=callbacks)
        finally:
            request_id.reset(token)
        logs = "\n".join(captured.output)
        self.assertNotIn(SECRET, logs)
        self.assertNotIn("malformed-private-identifier", logs)
        self.assertEqual(logs.count("skill.load.completed"), 4)
        self.assertEqual(logs.count("status=failure"), 4)
        self.assertEqual(logs.count("tool.failed"), 2)
        self.assertEqual(logs.count("tool.completed"), 2)
        self.assertTrue(all("request_id=failures " in line for line in captured.output))

    async def test_concurrent_streams_and_detached_memory(self):
        gate = asyncio.Event()
        started = []
        finished = []

        async def structured_chat(messages, schema):
            correlation = request_id.get()
            credential = access_token.get()
            started.append((correlation, credential))
            await gate.wait()
            self.assertEqual(request_id.get(), correlation)
            self.assertEqual(access_token.get(), credential)
            finished.append((correlation, credential))
            return schema(**({"memories": []} if schema is MemoryResponse else {"events": []}))

        agent = self.make_agent([AIMessage(content=SECRET)])
        agent.memory.llm.structured_chat = structured_chat

        async def consume(credential):
            body = ChatRequest(message=SECRET, history=[], accessToken=credential, mindSpaceId=uuid4())
            response = await main.chat(body, Request({"type": "http", "headers": []}))
            output = [chunk async for chunk in response.body_iterator]
            self.assertEqual("".join(output), SECRET)
            self.assertEqual(request_id.get(), "-")

        with patch.object(main, "agent", agent), self.assertLogs("agentcore", level="DEBUG") as captured:
            await asyncio.gather(consume("credential-A"), consume("credential-B"))
            self.assertEqual(len(started), 4)
            self.assertEqual(finished, [])
            gate.set()
            # Await only the extraction tasks started by this synthetic request.
            pending = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
            await asyncio.gather(*pending)
        logs = "\n".join(captured.output)
        self.assertNotIn(SECRET, logs)
        self.assertNotIn("credential-", logs)
        self.assertNotIn("request_id=-", logs)
        ids = {re.search(r"request_id=(\w+)", line).group(1) for line in captured.output}
        self.assertEqual(len(ids), 2)
        self.assertEqual(len(finished), 4)
        self.assertEqual(len(set(started)), 2)
        for correlation in ids:
            lines = [line for line in captured.output if f"request_id={correlation} " in line]
            text = "\n".join(lines)
            for event, count in [("chat.started", 1), ("chat.finished", 1),
                                 ("model.started", 1), ("model.completed", 1),
                                 ("memory.extract.started", 2), ("memory.extract.completed", 2)]:
                self.assertEqual(text.count(event), count, text)
            self.assertLess(text.index("chat.finished"), text.index("memory.extract.completed"))

    async def test_error_status_and_callback_correlation(self):
        token = request_id.set("captured")
        callbacks = ExecutionLogs(["registered"])
        request_id.reset(token)
        run_id = uuid4()
        with self.assertLogs("agentcore", level="DEBUG") as captured:
            await callbacks.on_tool_start({"name": SECRET}, SECRET, run_id=run_id)
            await callbacks.on_tool_end(ToolMessage(content=SECRET, tool_call_id="x", status="error"), run_id=run_id)
            # A repeated terminal notification must not duplicate the event.
            await callbacks.on_tool_error(RuntimeError(SECRET), run_id=run_id)
        logs = "\n".join(captured.output)
        self.assertNotIn(SECRET, logs)
        self.assertEqual(logs.count("tool.failed"), 1)
        self.assertIn("tool=unknown", logs)
        self.assertTrue(all("request_id=captured " in line for line in captured.output))

    async def test_streaming_multistep_and_background_failure(self):
        agent = self.make_agent([
            AIMessage(content="", tool_calls=[
                {"name": "load_skill", "args": {"identifier": "builtin:sample"}, "id": "skill"},
            ]),
            AIMessage(content=SECRET),
        ])
        gate = asyncio.Event()

        async def fail_extraction(messages, schema):
            await gate.wait()
            raise RuntimeError(SECRET)

        agent.memory.llm.structured_chat = fail_extraction
        body = ChatRequest(message=SECRET, history=[], accessToken=SECRET, mindSpaceId=uuid4())
        with patch.object(main, "agent", agent), self.assertLogs("agentcore", level="DEBUG") as captured:
            response = await main.chat(body, Request({"type": "http", "headers": []}))
            self.assertEqual("".join([chunk async for chunk in response.body_iterator]), SECRET)
            pending = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
            gate.set()
            await asyncio.gather(*pending, return_exceptions=True)
            await asyncio.sleep(0)  # Let detached-task exception observers run.
        logs = "\n".join(captured.output)
        self.assertNotIn(SECRET, logs)
        self.assertEqual(logs.count("model.completed"), 2)
        self.assertEqual(logs.count("tool.completed"), 1)
        self.assertEqual(logs.count("skill.load.completed"), 1)
        self.assertEqual(logs.count("memory.extract.failed"), 2)
        self.assertIn("chat.finished outcome=completed", logs)
        ids = {re.search(r"request_id=(\w+)", line).group(1) for line in captured.output}
        self.assertEqual(len(ids), 1)
        self.assertEqual(request_id.get(), "-")

    async def test_stream_close_restores_context(self):
        async def stream(*args):
            yield SECRET
            await asyncio.Event().wait()

        body = ChatRequest(message=SECRET, history=[], accessToken=SECRET, mindSpaceId=uuid4())
        with patch.object(main.agent, "stream", stream), self.assertLogs("agentcore", level="DEBUG") as captured:
            response = await main.chat(body, Request({"type": "http", "headers": []}))
            self.assertEqual(await anext(response.body_iterator), SECRET)
            await response.body_iterator.aclose()
        logs = "\n".join(captured.output)
        self.assertIn("chat.finished outcome=cancelled", logs)
        self.assertNotIn(SECRET, logs)
        self.assertEqual(request_id.get(), "-")


if __name__ == "__main__":
    unittest.main()
