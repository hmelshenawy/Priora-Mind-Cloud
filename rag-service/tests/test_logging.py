"""Synthetic ASGI requests with real RAG stages and in-memory Qdrant; no network/model download."""
import asyncio
import contextlib
import importlib
import io
import logging
import os
from pathlib import Path
import re
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
SECRET = "PRIVATE_CONTENT_TOKEN_PATH_QUERY_984731"
VECTORS = [0.123456789, 0.987654321]


class SyntheticModel:
    def __init__(self, model):
        pass

    def encode(self, texts, **kwargs):
        return SimpleNamespace(tolist=lambda: [VECTORS[:] for _ in texts])


class LoggingTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        model_module = ModuleType("sentence_transformers")
        model_module.SentenceTransformer = SyntheticModel
        cls.environment = patch.dict(os.environ, {
            "SUPABASE_URL": "https://example.invalid", "SUPABASE_SECRET_KEY": SECRET,
            "SUPABASE_STORAGE_BUCKET": SECRET, "EMBEDDING_MODEL": SECRET,
            "EMBEDDING_BATCH_SIZE": "32", "EMBEDDING_DIM": "2",
            "QDRANT_URL": ":memory:", "QDRANT_API_KEY": SECRET,
            "QDRANT_COLLECTION": "synthetic", "ENV": "test", "RAG_SECRET_KEY": SECRET,
        })
        cls.environment.start()
        sys.modules["sentence_transformers"] = model_module
        try:
            with patch("supabase.create_client", return_value=Mock()):
                cls.main = importlib.import_module("ragcore.main")
        finally:
            sys.modules.pop("sentence_transformers", None)
        from ragcore import logging_utils
        cls.logs = logging_utils

    @classmethod
    def tearDownClass(cls):
        cls.environment.stop()

    async def asyncSetUp(self):
        self.main.qdClient = self.main.QdClient(":memory:", None, 60)
        self.main.client.client.storage.from_.return_value.download.return_value = SECRET.encode()
        self.reader = patch("ragcore.pdfExtractor.PdfReader", return_value=SimpleNamespace(
            pages=[SimpleNamespace(extract_text=lambda: SECRET)]))
        self.reader.start()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.main.app, raise_app_exceptions=False), base_url="http://test")
        self.capture = self.assertLogs("ragcore", level="DEBUG")
        self.records = self.capture.__enter__()
        self.output = io.StringIO()
        self.stdout = contextlib.redirect_stdout(self.output)
        self.stdout.__enter__()

    async def asyncTearDown(self):
        await self.client.aclose()
        self.main.qdClient.client.close()
        self.reader.stop()
        self.stdout.__exit__(None, None, None)
        self.capture.__exit__(None, None, None)
        output = "\n".join(self.records.output) + self.output.getvalue()
        for forbidden in (SECRET, str(VECTORS), str(VECTORS[0]), "Traceback"):
            self.assertNotIn(forbidden, output)
        self.assertEqual(self.logs.request_id.get(), "-")
        self.assertIsNone(self.logs.request_state.get())

    async def post(self, operation, payload, correlation="test-id", key=SECRET):
        headers = {"X-Internal-Service-Key": key}
        if correlation is not None:
            headers["X-Request-ID"] = correlation
        return await self.client.post(f"/v1/{operation}", json=payload, headers=headers)

    def terminals(self):
        return [line for line in self.records.output if "request.finished " in line]

    async def ingest(self, correlation="ingest-id"):
        return await self.post("ingest", dict(fileName=SECRET, storageKey=SECRET, source_id=SECRET, mindSpaceId=SECRET), correlation)

    async def test_ingest_search_embed_and_stage_contract(self):
        response = await self.ingest()
        self.assertEqual(response.json(), {"status": "Ingestion done", "textLength": 1})
        response = await self.post("search", dict(query=SECRET, topK=5, mindSpaceId=SECRET), "search-id")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["points"]), 1)
        response = await self.post("embed", {"texts": [SECRET]}, "embed-id")
        self.assertEqual(response.json(), {"vectors": [VECTORS]})
        self.assertEqual(len(self.terminals()), 3)
        for record in self.terminals():
            self.assertIn("outcome=completed", record)
            self.assertIn("status_code=200", record)
            self.assertRegex(record, r"duration_ms=\d+")
        output = "\n".join(self.records.output)
        for event in ("storage.download.completed", "document.extract.completed", "chunking.completed", "embedding.completed", "qdrant.collection.created", "qdrant.upsert.completed", "qdrant.search.completed"):
            self.assertIn(event, output)
        self.assertLess(output.index("qdrant.upsert.completed"), output.index("indexed_count=1"))
        self.assertIn("request_id=ingest-id service=rag chunking.completed", output)
        self.assertIn("request_id=search-id service=rag qdrant.search.completed", output)
        self.assertIn("request_id=embed-id service=rag embedding.completed", output)
        self.assertNotIn("completed_point_count=", output)

    async def test_existing_collection_and_zero_hits(self):
        await self.ingest()
        await self.ingest()
        response = await self.post("search", dict(query=SECRET, topK=5, mindSpaceId="another-private-tenant"))
        self.assertEqual(response.json()["points"], [])
        self.assertIn("result_count=0", self.terminals()[-1])
        self.assertTrue(self.terminals()[-1].startswith("INFO:"))
        self.assertIn("qdrant.collection.checked", "\n".join(self.records.output))
        self.assertNotIn("another-private-tenant", "\n".join(self.records.output))

    async def test_authorization_and_invalid_json(self):
        for operation in ("ingest", "search", "embed"):
            response = await self.post(operation, {}, key="wrong-private-key")
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json(), {"detail": "Unauthorized service"})
        response = await self.client.post("/v1/embed", content=b"{", headers={"X-Internal-Service-Key": SECRET})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(len(self.terminals()), 4)
        for line in self.terminals()[:3]:
            self.assertTrue(line.startswith("WARNING:"))
            self.assertIn("stage=auth error_code=service_auth_failed", line)
        self.assertIn("stage=parse error_code=parse_failed", self.terminals()[-1])
        self.assertNotIn("wrong-private-key", "\n".join(self.records.output))

    async def test_ids_validated_and_generated(self):
        for supplied in ("valid_ID-123", None, "bad id", "a" * 65, "-", "bad\nline"):
            response = await self.post("embed", {"texts": [SECRET]}, supplied)
            self.assertEqual(response.status_code, 200)
            line = self.terminals()[-1]
            correlation = re.search(r"request_id=(\S+)", line).group(1)
            if supplied == "valid_ID-123":
                self.assertEqual(correlation, supplied)
            else:
                self.assertRegex(correlation, r"^[0-9a-f]{32}$")
        self.assertEqual(len(self.terminals()), 6)

    async def test_concurrent_ids(self):
        # Hold body reception so both ContextVars are active before either stage runs.
        arrived = 0
        ready = asyncio.Event()

        async def call(correlation):
            nonlocal arrived
            sent = False
            messages = []
            async def receive():
                nonlocal arrived, sent
                if not sent:
                    sent = True
                    arrived += 1
                    if arrived == 2:
                        ready.set()
                    await ready.wait()
                    return {"type": "http.request", "body": b'{"texts":["synthetic"]}'}
                return {"type": "http.disconnect"}
            async def send(message):
                messages.append(message)
            await self.main.app(self.scope(correlation), receive, send)
            self.assertEqual(messages[0]["status"], 200)
        await asyncio.gather(call("first"), call("second"))
        self.assertEqual(len(self.terminals()), 2)
        for correlation in ("first", "second"):
            lines = [line for line in self.records.output if f"request_id={correlation} " in line]
            self.assertEqual(sum("request.finished " in line for line in lines), 1)
            self.assertTrue(any("embedding.completed" in line for line in lines))

    def scope(self, correlation):
        return dict(type="http", asgi={"version": "3.0"}, http_version="1.1", method="POST", scheme="http", path="/v1/embed", raw_path=b"/v1/embed", query_string=b"", root_path="", server=("test", 80), client=("test", 1), headers=[(b"x-request-id", correlation.encode()), (b"x-internal-service-key", SECRET.encode()), (b"content-type", b"application/json")])

    async def test_cancellation_preserved(self):
        async def receive():
            raise asyncio.CancelledError()
        with self.assertRaises(asyncio.CancelledError):
            await self.main.app(self.scope("cancelled-id"), receive, Mock())
        self.assertEqual(len(self.terminals()), 1)
        self.assertIn("outcome=cancelled", self.terminals()[0])
        self.assertTrue(self.terminals()[0].startswith("DEBUG:"))
        self.assertNotIn("status_code=", self.terminals()[0])

    async def test_partial_upsert_failure(self):
        # 51 chunks causes two actual wrapper batches; only the first succeeds.
        page = SimpleNamespace(extract_text=lambda: " ".join([SECRET] * (260 * 51)))
        self.reader.stop()
        self.reader = patch("ragcore.pdfExtractor.PdfReader", return_value=SimpleNamespace(pages=[page]))
        self.reader.start()
        with patch.object(self.main.qdClient.client, "upsert", side_effect=[None, RuntimeError(SECRET)]):
            response = await self.ingest()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(len(self.terminals()), 1)
        line = self.terminals()[0]
        self.assertIn("outcome=failed", line)
        self.assertIn("stage=upsert error_code=qdrant_upsert_failed", line)
        self.assertIn("completed_point_count=50 completed_batch_count=1", line)
        self.assertNotIn("indexed_count", line)
        self.assertNotIn("qdrant.upsert.completed", "\n".join(self.records.output))

    async def test_embedding_failure(self):
        with patch.object(self.main.embedding.model, "encode", side_effect=RuntimeError(SECRET)):
            response = await self.post("embed", {"texts": [SECRET]})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(len(self.terminals()), 1)
        self.assertIn("stage=embed error_code=embed_failed", self.terminals()[0])
        self.assertNotIn("embedding.completed", "\n".join(self.records.output))

    async def test_dependency_and_uvicorn_output_is_safe(self):
        # Exercise the same filter Uvicorn's separate handler uses.
        output = io.StringIO()
        handler = logging.StreamHandler(output)
        handler.addFilter(self.logs.SafeOutput())
        for name, msg, exc in (("httpx", SECRET, None), ("uvicorn.error", "Exception in ASGI application\n", (RuntimeError, RuntimeError(SECRET), None))):
            record = logging.LogRecord(name, logging.ERROR, "", 0, msg, (), exc)
            handler.handle(record)
        self.assertNotIn(SECRET, output.getvalue())
        self.assertNotIn("Exception in ASGI", output.getvalue())
        await self.post("embed", {"texts": [SECRET]})


if __name__ == "__main__":
    unittest.main()
