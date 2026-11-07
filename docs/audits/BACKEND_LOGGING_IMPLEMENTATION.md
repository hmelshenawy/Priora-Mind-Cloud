# Backend logging implementation

Implemented 2026-11-07. No dependencies added; no commit or push.

## Behavior

- Backend validates a single bounded request-ID header, generates a UUID otherwise, returns it in responses and exposes it through CORS.
- Nest Logger emits metadata-only key/value events. HTTP finish/close share a once-only terminal guard. The exception filter preserves Nest response mapping without logging raw exceptions.
- Node's standard-library AsyncLocalStorage carries request metadata through existing service calls; no request-scoped provider graph or logging framework was introduced. This replaces the audit's suggested explicit parameter threading to avoid changing every service signature. Jobs persist explicit correlation metadata separately.
- Agent chat accepts Backend correlation, preserves existing ContextVar lifetime/background inheritance, and forwards it on internal memory/tool/skill/PDF calls. Existing RAG ingress and Agent-to-RAG propagation required no changes.
- Jobs preserve upload correlation through retries, including persisted fallback metadata for legacy jobs. Each attempt has one terminal outcome. Separate random job correlation avoids logging document IDs.
- Sensitive console calls were removed. Memory searches, Agent streaming, ingestion and queue stages use aggregate DEBUG events; HTTP and job outcomes own INFO/WARN/ERROR. Task/note counts distinguish committed writes from existing duplicate records.
- Production defaults to Nest log/warn/error; `LOG_LEVEL=debug` enables DEBUG. Existing response bodies/status mapping, auth/ownership checks, stream consumption/persistence, queue retry options and Python cancellation behavior remain intact.

## Files

New:

- `backend/src/logging/request-logging.ts`
- `backend/test/structured-logging.test.cjs`
- `agent-service/tests/test_backend_correlation.py`
- This implementation report.

Modified Backend files:

- `backend/src/main.ts`
- `backend/src/agent/agent.service.ts`
- `backend/src/conversations/conversation-messages.service.ts`
- `backend/src/documents/documents.controller.ts`
- `backend/src/documents/documents.service.ts`
- `backend/src/documents/document.processor.ts`
- `backend/src/documents/rag.service.ts`
- `backend/src/documents/storage.service.ts`
- `backend/src/memory/memory.controller.ts`
- `backend/src/memory/memory.service.ts`
- `backend/src/memory/event.service.ts`
- `backend/src/notes/notes.service.ts`
- `backend/src/tasks/tasks.service.ts`

Modified Agent files:

- `agent-service/src/agentcore/main.py`
- `agent-service/src/agentcore/memory/memory.py`
- `agent-service/src/agentcore/skills/skill_loader.py`
- `agent-service/src/agentcore/tools/notes.py`
- `agent-service/src/agentcore/tools/tasks.py`
- `agent-service/src/agentcore/tools/pdf_generator.py`
- `agent-service/tests/test_execution_logging.py` (supply Request to the updated chat signature).

The pre-existing untracked `BACKEND_LOGGING_AUDIT.md` was retained unchanged. RAG application files, package manifests, schemas and authentication code were not changed.

## Verification

| Check | Result |
|---|---|
| Backend: `node --test test/structured-logging.test.cjs` | 5 tests passed, with multiple scenarios per test |
| Backend: `node -r ts-node/register --test test/rag-correlation.test.cjs` | 3 tests passed |
| Backend: `node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.json` | Passed |
| Agent: `.venv/Scripts/python.exe -B -m unittest discover -s tests -v` | 10 tests passed |
| RAG: `.venv/Scripts/python.exe -m unittest discover -s tests -v` | 9 tests passed |
| Python in-memory `compile()` over Agent source/tests and RAG source | 56 files passed; no bytecode written by syntax check |
| `git diff --check` | Passed |
| Source scan for `console.` under Backend source | No remaining matches |

Coverage includes concurrent HTTP contexts, missing/invalid/duplicate IDs, validation/guard failures, streaming success/error/disconnect, persistence failure after headers, one terminal HTTP event, safe content exclusion, upload-to-worker-to-RAG IDs, retry/legacy correlation, failed final status persistence, dependency status/timeout classification, and task/note counts. Python tests exercise actual chat ContextVar propagation into real RAG ingress middleware, existing detached work/cancellation, and all internal Authorization header dictionaries.

Limits: verification is synthetic and composed across service boundaries, not a deployed three-service end-to-end run. Backend HTTP tests use a real Nest server and local HTTP upstream; database/storage/queue/model operations are test doubles. Actual Redis retries, PostgreSQL writes, Supabase storage, model execution and production proxies were not exercised. Callback header coverage includes static AST assertions, not live calls to every internal endpoint. Existing BullMQ failed-job error storage and process/bootstrap diagnostics are not a log-store/privacy audit. No full Jest E2E or lint suite was claimed.
