"""Metadata-only logging using the Agent's stdlib event convention."""
import asyncio
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
import logging
import os
import re
from time import perf_counter
from uuid import uuid4

request_id = ContextVar("rag_request_id", default="-")


@dataclass
class RequestState:
    stage: str = "auth"
    counts: dict = field(default_factory=dict)
    error_code: str | None = None


# A per-request object also carries updates made in FastAPI's sync auth thread.
request_state = ContextVar("rag_request_state", default=None)


class RequestLogger(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        return f"request_id={request_id.get()} service=rag {msg}", kwargs


def get_logger(name):
    return RequestLogger(logging.getLogger(name), {})


class SafeOutput(logging.Filter):
    """Dependency messages/tracebacks are not part of our safe field contract."""
    def filter(self, record):
        if record.name == "uvicorn.access":
            return False
        if record.name.startswith("ragcore"):
            return True
        if record.name == "uvicorn.error" and record.msg in {
            "Started server process [%d]", "Finished server process [%d]",
            "Waiting for application startup.", "Application startup complete.",
            "Shutting down", "Waiting for application shutdown.", "Application shutdown complete.",
        }:
            return True
        if record.name == "uvicorn.error" and record.exc_info:
            # The outer request boundary already reports ASGI failures once.
            if str(record.msg).startswith("Exception in ASGI application"):
                return False
        if record.levelno < logging.WARNING:
            return False
        record.msg = "dependency.failed" if record.levelno >= logging.ERROR else "dependency.warning"
        record.args = ()
        record.exc_info = None
        record.exc_text = None
        record.stack_info = None
        return True


def configure_logging():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s", force=True)
    logging.getLogger("ragcore").setLevel(
        logging.DEBUG if os.getenv("RAG_LOG_LEVEL", "INFO").upper() == "DEBUG" else logging.INFO
    )
    for handler in logging.getLogger().handlers:
        handler.addFilter(SafeOutput())
    for name in ("httpx", "httpcore", "sentence_transformers", "transformers", "huggingface_hub", "qdrant_client", "supabase", "storage3", "pypdf"):
        logging.getLogger(name).setLevel(logging.WARNING)
    # Uvicorn owns separate handlers, so the root handler alone is insufficient.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.addFilter(SafeOutput())
        for handler in logger.handlers:
            handler.addFilter(SafeOutput())


def set_stage(name):
    state = request_state.get()
    if state is not None:
        state.stage = name


def counts(**values):
    state = request_state.get()
    if state is not None:
        state.counts.update(values)


@contextmanager
def stage(logger, name, event, level=logging.DEBUG, **fields):
    set_stage(name)
    started = perf_counter()
    yield fields
    fields["duration_ms"] = int((perf_counter() - started) * 1000)
    logger.log(level, event + " " + " ".join(f"{key}={value}" for key, value in fields.items()))


class RequestLoggingMiddleware:
    """Outer ASGI boundary: includes auth, response sending and server errors."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        supplied = [v.decode("latin-1") for k, v in scope.get("headers", []) if k.lower() == b"x-request-id"]
        correlation = supplied[0] if len(supplied) == 1 and re.fullmatch(r"[A-Za-z0-9_-]{1,64}", supplied[0]) and supplied[0] != "-" else uuid4().hex
        id_token = request_id.set(correlation)
        state = RequestState()
        state_token = request_state.set(state)
        logger = get_logger("ragcore.main")
        started = perf_counter()
        route = scope.get("path")
        operation = {"/v1/ingest": "ingest", "/v1/search": "search", "/v1/embed": "embed", "/v1/health": "health"}.get(route, "unknown")
        route = route if operation != "unknown" else "unmatched"
        method = scope.get("method")
        method = method if method in {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"} else "OTHER"
        status = None
        outcome = "completed"
        error_type = None

        async def observed_send(message):
            nonlocal status
            await send(message)
            if message["type"] == "http.response.start":
                status = message["status"]

        logger.debug("request.started method=%s route=%s operation=%s", method, route, operation)
        try:
            await self.app(scope, receive, observed_send)
            if status is not None and status >= 400:
                outcome = "failed" if status >= 500 else "rejected"
        except (asyncio.CancelledError, GeneratorExit):
            outcome = "cancelled"
            raise
        except Exception as exc:
            outcome = "failed"
            error_type = type(exc).__name__
            raise
        finally:
            try:
                level = {"completed": logging.INFO, "rejected": logging.WARNING, "failed": logging.ERROR, "cancelled": logging.DEBUG}[outcome]
                if operation == "health" and outcome == "completed":
                    level = logging.DEBUG
                fields = dict(operation=operation, method=method, route=route, outcome=outcome,
                              duration_ms=int((perf_counter() - started) * 1000))
                if status is not None:
                    fields["status_code"] = status
                if outcome != "completed":
                    fields["stage"] = state.stage
                    if outcome != "cancelled":
                        prefix = "qdrant_" if state.stage in {"collection", "upsert", "search"} else ""
                        fields["error_code"] = state.error_code or ("request_rejected" if outcome == "rejected" else f"{prefix}{state.stage}_failed")
                    if error_type:
                        fields["error_type"] = error_type if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,63}", error_type) else "Exception"
                fields.update(state.counts)
                if outcome == "completed":
                    fields.pop("completed_point_count", None)
                    fields.pop("completed_batch_count", None)
                logger.log(level, "request.finished " + " ".join(f"{k}={v}" for k, v in fields.items()))
            finally:
                request_state.reset(state_token)
                request_id.reset(id_token)
