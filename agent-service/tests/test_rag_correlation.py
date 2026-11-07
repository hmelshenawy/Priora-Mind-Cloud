"""Verify existing correlation and caller contracts without external services."""
import asyncio
import unittest
from unittest.mock import Mock, patch

from agentcore.context import mindSpaceId
from agentcore.memory.memory import UserProfileMemory, EventMemory, request_id
from agentcore.tools.knowledge import searchKnowledge


class RagCorrelationTests(unittest.IsolatedAsyncioTestCase):
    async def test_both_memory_callers_forward_context_into_thread(self):
        response = Mock()
        response.json.return_value = {"vectors": [[0.1, 0.2]]}
        token = request_id.set("agent-memory-request")
        try:
            for memory_type in (UserProfileMemory, EventMemory):
                memory = memory_type.__new__(memory_type)
                with patch("agentcore.memory.memory.requests.post", return_value=response) as post:
                    result = await memory.embed("private-input")
                self.assertEqual(result, [0.1, 0.2])
                self.assertEqual(post.call_args.kwargs["headers"]["X-Request-ID"], "agent-memory-request")
                self.assertEqual(post.call_args.kwargs["json"], {"texts": ["private-input"]})
                self.assertEqual(post.call_args.kwargs["timeout"], (10, 60))
                self.assertIn("X-Internal-Service-Key", post.call_args.kwargs["headers"])
        finally:
            request_id.reset(token)

    async def test_knowledge_callers_keep_concurrent_contexts(self):
        def post(url, **kwargs):
            correlation = kwargs["headers"]["X-Request-ID"]
            self.assertEqual(kwargs["timeout"], (60, 120))
            self.assertIn("X-Internal-Service-Key", kwargs["headers"])
            return Mock(ok=True, json=lambda: {"correlation": correlation})

        async def search(correlation):
            token = request_id.set(correlation)
            space_token = mindSpaceId.set("private-tenant")
            try:
                response = await asyncio.to_thread(searchKnowledge, "private-query")
                self.assertEqual(response, {"correlation": correlation})
            finally:
                mindSpaceId.reset(space_token)
                request_id.reset(token)

        with patch("agentcore.tools.knowledge.requests.post", side_effect=post):
            await asyncio.gather(search("first-agent"), search("second-agent"))
        self.assertEqual(request_id.get(), "-")


if __name__ == "__main__":
    unittest.main()
