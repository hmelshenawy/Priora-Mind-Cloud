"""Exercise real chat ingress/context and RAG callers without model/network access."""
import asyncio
import ast
import importlib.util
import sys
from pathlib import Path
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from starlette.requests import Request
from agentcore import main
from agentcore.schemas import ChatRequest
from agentcore.memory.memory import request_id, UserProfileMemory


class BackendCorrelationTests(unittest.IsolatedAsyncioTestCase):
    async def test_ingress_to_rag_concurrent_and_fallback_ids(self):
        seen = []
        rag_seen = []
        # Load the real stdlib-only RAG ingress middleware without its model/server.
        path = Path(__file__).resolve().parents[2] / "rag-service/src/ragcore/logging_utils.py"
        spec = importlib.util.spec_from_file_location("correlation_rag_logging", path)
        rag = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = rag
        spec.loader.exec_module(rag)

        async def rag_app(scope, receive, send):
            rag_seen.append(rag.request_id.get())
            await send({"type": "http.response.start", "status": 200})
            await send({"type": "http.response.body", "body": b"{}"})


        async def stream(message, history):
            before = request_id.get()
            await asyncio.sleep(0)
            self.assertEqual(request_id.get(), before)
            memory = UserProfileMemory.__new__(UserProfileMemory)
            await memory.embed("PRIVATE_INPUT")
            seen.append(before)
            yield "PRIVATE_OUTPUT"

        def post(url, **kwargs):
            self.assertEqual(kwargs["headers"]["X-Request-ID"], request_id.get())
            async def invoke_rag():
                async def send(message):
                    pass
                async def receive():
                    return {"type": "http.request", "body": b""}
                await rag.RequestLoggingMiddleware(rag_app)({"type": "http", "method": "POST", "path": "/v1/embed", "headers": [(b"x-request-id", kwargs["headers"]["X-Request-ID"].encode())]}, receive, send)
                self.assertEqual(rag.request_id.get(), "-")
            asyncio.run(invoke_rag())
            return Mock(json=lambda: {"vectors": [[0.1]]})

        async def consume(values):
            request = Request({"type": "http", "headers": [(b"x-request-id", v.encode()) for v in values]})
            body = ChatRequest(message="PRIVATE_INPUT", history=[], accessToken="PRIVATE_JWT", mindSpaceId=uuid4())
            response = await main.chat(body, request)
            self.assertEqual([chunk async for chunk in response.body_iterator], ["PRIVATE_OUTPUT"])
            self.assertEqual(request_id.get(), "-")

        values = [["backend-one"], ["backend-two"], [], ["-"], ["bad id"], ["x" * 65], ["same", "same"]]
        with patch.object(main, "agent", Mock(stream=stream)), patch("agentcore.memory.memory.requests.post", side_effect=post), self.assertLogs("agentcore", level="DEBUG") as logs:
            await asyncio.gather(*(consume(value) for value in values))
        self.assertCountEqual(rag_seen, seen)
        self.assertIn("backend-one", seen)
        self.assertIn("backend-two", seen)
        self.assertEqual(len(set(seen)), len(values))
        for value in seen:
            if not value.startswith("backend-"):
                self.assertRegex(value, r"^[a-f0-9]{32}$")
        self.assertNotIn("PRIVATE_", "\n".join(logs.output))

    def test_all_internal_authorization_headers_forward_context(self):
        # Check every actual header dictionary, not just a matching string in each file.
        root = Path(main.__file__).parent
        for filename in ["memory/memory.py", "tools/notes.py", "tools/tasks.py", "tools/pdf_generator.py", "skills/skill_loader.py"]:
            tree = ast.parse((root / filename).read_text(encoding="utf-8"))
            headers = [node for node in ast.walk(tree) if isinstance(node, ast.Dict) and any(isinstance(key, ast.Constant) and key.value == "Authorization" for key in node.keys)]
            self.assertTrue(headers, filename)
            for header in headers:
                values = {key.value: value for key, value in zip(header.keys, header.values) if isinstance(key, ast.Constant)}
                self.assertEqual(ast.unparse(values["X-Request-ID"]), "request_id.get()", filename)


if __name__ == "__main__":
    unittest.main()
