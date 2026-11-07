# Backend logging audit

Date: 2026-11-07. Read-only source audit; recommendations only.

## Scope and findings

Reviewed first-party source, tests, package/startup configuration and logging references across `backend/`; traced callers in Agent and RAG source. Paths/lines describe this checkout. Excluded generated Prisma/build output, installed dependencies from the application-call inventory, secret environment files and historical runtime logs. Inspected installed Nest exception/logger implementation specifically to verify implicit logging. Hidden `.agents/skills/` Markdown contains third-party illustrative logging snippets, not executed backend calls; these are outside the application inventory.

Found **13 active application logging calls**: eight `console` calls and five Nest `Logger` calls; also three commented-out calls. Highest-priority removal: uploaded-file output and streamed Agent content. No explicit active JWT, authorization-header, conversation-history, signed-URL or raw user-message logging was found. This does **not** establish that arbitrary errors or framework output are safe.

No request lifecycle/correlation middleware, custom logging interceptor or exception filter exists. `JwtGuard`, JWT strategy and global throttling have no custom logs. `FileInterceptor` is used for uploads but is not a logging interceptor. Auth, users, tasks, notes, mindspaces, conversations CRUD, user-skills and Prisma have no explicit logging calls beyond the inventory below. `RagService` has correlation forwarding but no logs. No other first-party logger library, stdout/stderr writer or query logging configuration was found.

## Current logging inventory

Paths in this table are relative to `backend/`. KEEP means retain the safe event/facility; metadata enrichment is described below. REMOVE means delete the call, not merely hide it behind DEBUG. REPLACE means preserve diagnostic purpose using safe structured metadata.

| Location | Current output | Decision | Reason / proposed disposition |
|---|---|---|---|
| `src/main.ts:27` | `Logger.log` listening port | KEEP | Safe startup outcome; normalize to INFO `backend.started`, validated numeric `port`. |
| `src/agent/agent.service.ts:44` | `console.error` upstream HTTP status | REPLACE | Safe number, but uncorrelated and followed by a thrown error; attach `upstream_http_status` and `error_code=agent_http_failed` to the owning request outcome. |
| `src/agent/agent.service.ts:58` | `console.log(error)` on timeout | REPLACE | Arbitrary exception object, wrong level; WARN outcome with `error_code=agent_timeout`. |
| `src/conversations/conversation-messages.service.ts:53` | `console.log(agentReply)` | REMOVE | Currently a `ReadableStream` object, **not** a decoded full response. Unhelpful object dump; stream lifecycle events suffice. |
| `src/conversations/conversation-messages.service.ts:66` | JSON-stringified decoded chunk | REMOVE | Direct Agent-output disclosure, potentially user/third-party personal data or tool-derived content; per-chunk volume. JSON escaping is not redaction. |
| `src/documents/documents.controller.ts:25` | Entire Multer file | REMOVE | Includes original filename, metadata and buffer bytes, before service validation/ownership checks. |
| `src/documents/storage.service.ts:24-28` | Storage error name/message/status | REPLACE | Provider message is untrusted and may include paths/identifiers; record fixed `storage_upload_failed` and numeric upstream status in request outcome. |
| `src/documents/documents.service.ts:75` | Queue error object | REPLACE | May expose infrastructure/payload details; annotate request outcome `document_enqueue_failed`, ERROR even though current code returns HTTP 400. |
| `src/documents/document.processor.ts:28` | DEBUG `document.processing.started` | KEEP | Safe event; add stable correlation, attempt metadata and `operation=ingest`. |
| `src/documents/document.processor.ts:36` | DEBUG `document.ingest.started` | KEEP | Safe stage boundary; enrich with `stage=rag_ingest`. |
| `src/documents/document.processor.ts:45` | INFO `document.processing.completed` | KEEP | Safe outcome; add duration and attempt metadata after READY update succeeds. |
| `src/documents/document.processor.ts:47` | ERROR `document.processing.failed` | REPLACE | Safe text but all failures use same severity/code and lack stage/attempt/duration; use classified failure event below. |
| `src/memory/memory.controller.ts:26` | Controller-hit message | REMOVE | No outcome information; duplicate of request start. |
| `src/memory/event.service.ts:100` | Search-start message | REPLACE | DEBUG `memory.search.completed` with kind, result count and duration, emitted once after search. |
| `src/memory/memory.service.ts:47,48,49` | Commented user ID / DTO / mindspace logs | REMOVE | Inactive today; remove dormant identity, embedding and content-dump patterns. |

Logger declarations/imports: `src/main.ts:4`, `src/documents/document.processor.ts:3,11`: **KEEP** Nest logging facilities. `test/rag-correlation.test.cjs:43,47`: **KEEP** console mock/assertion; not production output. Other test/config files contain no active first-party logging calls.

Implicit paths requiring attention during implementation:

- `src/main.ts:7` uses Nest's default logger. Installed `node_modules/@nestjs/core/exceptions/base-exception-filter.js:34-53` passes unknown exceptions to `logger.error(exception)`. Prisma/fetch errors can therefore reach logs even in otherwise silent services. Replace the raw exception logging path with sanitized failure ownership while preserving response/status behavior; do not log safely and then invoke the same raw-error logger again.
- Installed `node_modules/@nestjs/common/services/console-logger.service.js:9-16,58` enables DEBUG/VERBOSE by default. Set production levels explicitly in the future; INFO corresponds to Nest `log()`, then `warn()`/`error()`, with DEBUG opt-in. Retain ordinary safe Nest startup messages, but avoid a second custom startup summary.
- `src/prisma/prisma.service.ts:8-12` does not enable query logging. Keep it disabled: memory/event SQL includes content, vectors and personal data. Queue exceptions are rethrown (`document.processor.ts:56`); BullMQ failed-job diagnostics/stack storage are a separate potential disclosure surface, not a confirmed console dump. Do not add raw `failed`/`error` listeners.

## Minimal structured contract

Reuse `new Logger(Class.name)` and one-line key/value messages, matching the existing processor and Python convention. No dependencies, tracing platform, generic logging service, repository wrappers or per-record logs. Use fixed event names and explicit scalar allowlists, never spread DTOs, errors, requests or responses into fields.

Common fields: `request_id`, `service=backend`, fixed `operation`, `status` (`started|completed|rejected|failed|cancelled`), integer nonnegative `duration_ms` on terminal events. Nest supplies timestamp, level and class context. Startup uses `request_id=-`. Backend `status` corresponds to Python `outcome`; Backend `http_status` corresponds to RAG `status_code`; no Python rename is needed.

Allowed optional fields: allowlisted HTTP `method`; route **template** such as `/api/v1/conversations/:id/messages` (or `unmatched`, never URL/query); numeric `http_status` and `upstream_http_status`; fixed `stage`, `error_code`, `dependency`; nonnegative `result_count`, `saved_count`, `history_count`, `chunk_count`, `output_chars`, `input_count`; `attempt`, `max_attempts`, boolean `will_retry`; validated random `job_correlation_id`. Omit unavailable values rather than inventing counts. Chunk count means transport reads, not tokens. Measure durations with a monotonic clock.

Never log raw bodies, user messages/history, JWTs, credentials, headers, cookies, IP/email/name, uploaded files/buffers/filenames, storage keys, signed/full URLs, embeddings, memory/event attributes, skill instructions, tool arguments/results, Agent chunks, arbitrary exception messages/stacks/causes or provider error bodies. Omit user/tenant/document/conversation IDs by default. Existing BullMQ `jobId` equals document ID on normal uploads (`documents.service.ts:60`), so it is not a safe substitute for generated correlation. Validation logs use fixed codes/counts, not serialized validation errors.

| Exact event | Level | Owner / safe extra fields |
|---|---|---|
| `backend.started` | INFO | Bootstrap; `operation=startup status=completed port`. |
| `request.started` | DEBUG | HTTP boundary; method, route template if resolved, operation (otherwise `unknown`). |
| `request.finished` | INFO success; WARN expected rejection/timeout; ERROR unexpected failure; DEBUG normal disconnect | Exactly once per request; method, resolved route, operation, status, duration, actual HTTP status if sent, fixed failure code/stage, optional result/saved count. Successful health probes use DEBUG. |
| `agent.call.started` | DEBUG | AgentService; `operation=chat dependency=agent history_count`. No request DTO. |
| `agent.stream.opened` | DEBUG | Successful upstream headers/body available; `operation=chat upstream_http_status duration_ms` (time to stream open, not total). |
| `agent.stream.finished` | DEBUG | Stream owner; `operation=chat status duration_ms chunk_count output_chars`, fixed error code on failure; summary once, including cancellation. HTTP outcome owns WARN/ERROR. |
| `document.enqueued` | DEBUG | After successful queue add; `operation=upload status=completed job_correlation_id max_attempts duration_ms`. HTTP INFO means accepted/queued, not ingested. |
| `document.processing.started` | DEBUG | Worker attempt; `operation=ingest status=started job_correlation_id attempt max_attempts`. |
| `document.ingest.started` | DEBUG | Worker; same context, `stage=rag_ingest`. |
| `document.ingest.completed` | DEBUG | After successful RAG call; same context, `status=completed duration_ms`. Only validated numeric counts if actually available. |
| `document.processing.completed` | INFO | After RAG success **and** READY persistence; `status=completed duration_ms` plus attempt context. |
| `document.processing.failed` | WARN expected rejection/timeout; ERROR unexpected failure | One per failed attempt, including final failure; stage, fixed error code, duration, attempt/max, `will_retry`. Retrying does not turn an unexpected defect into WARN. |
| `memory.search.completed` | DEBUG | Memory/event services after successful query; `operation=memory.search`, `kind` = `profile` or `event`, `result_count duration_ms`. Includes similarity lookup during creation only when stage diagnosis is enabled. |

Important synchronous operations need **no additional INFO success event**: use `request.finished` with these exact operations, resolved from handler metadata/static routing, not user text:

- `auth.register`, `auth.login`, `auth.me`, `users.placeholder` (current `users.controller.ts:11-14` returns a constant, not a user list); no login identity or token fields.
- `memory.create`, `memory.search`, `memory.event.create`, `memory.event.search`; successful create `saved_count=1`, duplicate rejection `error_code=memory_duplicate`/`event_duplicate` (WARN).
- `tasks.create|list|get|update|delete`, `notes.create|list|get|update|delete`, `mindspaces.create|list|get|update|delete`, `conversations.create|list|get|update|delete`, `messages.list`, `messages.create`, `user_skills.create|list|get|update|delete` (each suffix denotes a separate exact operation string).
- `documents.upload`, `documents.list`, `documents.delete`, `documents.generated`, `documents.test_queue`; generated upload/signed-URL creation outcome only, never returned URL. Use `app.hello` for the existing root Hello World handler (`app.controller.ts:8-10`), and `unknown` for unmatched requests. No dedicated backend health endpoint currently exists; the health DEBUG rule applies if one is introduced.

Only derive result counts at the existing service boundary; never serialize/intercept arbitrary response bodies to count them. A committed create/update/delete may attach `saved_count=1`; list/search may attach array length. The chat request is completed only after stream consumption and message persistence (`conversation-messages.service.ts:60-85`); upstream EOF alone does not establish persistence success.

Failure codes should be fixed and bounded: `validation_failed`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `client_disconnected`, `agent_timeout`, `agent_http_failed`, `agent_empty_stream`, `agent_stream_failed`, `message_persist_failed`, `storage_upload_failed`, `storage_delete_failed`, `storage_sign_failed`, `document_enqueue_failed`, `rag_timeout`, `rag_http_failed`, `document_status_update_failed`, `unknown_job`, `internal_error`, plus memory duplicate codes above. Do not derive codes from error text. Expected auth/validation/ownership/duplicate/429 rejection is WARN. Upstream 5xx, network defects and database failures are ERROR; classify by cause, not just the current outward status (some dependency failures are converted to 400). Distinguish actual upstream status from Backend status.

## HTTP and failure ownership

Use a small HTTP middleware boundary before guards to establish correlation/start time and observe response `finish`/premature `close`; a success-only interceptor misses guard failures and manual streaming. Add only the minimal Nest exception-filter handling needed to annotate safe failure metadata and replace default raw exception output. Preserve existing responses and status codes. Keep a once-only completion flag: `finish` followed by `close` must not emit two terminal records.

For manual `@Res()` streaming (`conversations.controller.ts:19-39`), retain context through iterator consumption and persistence. An error after headers are sent must record `status=failed` and the actual sent `http_status` (possibly 200), never a fictional 500 or success based on HTTP status alone. If no response was sent, omit `http_status`. Client disconnect is DEBUG cancellation; distinguish it from unexpected stream failure. Finalize the logging lifecycle on error/abort as well as normal EOF, without logging chunks or attempting a second response.

Request boundary owns synchronous WARN/ERROR; services attach safe stage/code/count metadata instead of logging then rethrowing the same failure. Worker owns job failures; RAG/Agent DEBUG summaries describe separate dependency stages. Handle unknown job names inside the worker's safe outcome boundary (currently thrown before its try block at `document.processor.ts:21-23`); never interpolate arbitrary job names. Preserve the original failure stage if the final FAILED-state update itself fails, using a fixed secondary code if needed.

## X-Request-ID: current chain and minimal changes

| Hop | Current evidence | Required follow-up |
|---|---|---|
| Client → Backend | No ingress handling in `backend/src/main.ts:6-28`; no request-local context | Accept exactly one safe header matching `[A-Za-z0-9_-]{1,64}`, except `-`; otherwise generate `randomUUID()`. Reject duplicate/array/comma-joined values as metadata and generate instead, without logging invalid input or rejecting the business request. IDs are diagnostic, never identity/auth. |
| Backend → Agent | `backend/src/agent/agent.service.ts:33-36` sends content type/internal key only | Pass validated request ID explicitly through controller → message service → AgentService and add `X-Request-ID`. Do not add it to the Agent body or reuse JWT/resource IDs. |
| Agent ingress | `agent-service/src/agentcore/main.py:54,61-62` generates `uuid4().hex` inside streaming generator, ignoring caller ID | Separate Agent follow-up must accept/validate the header and initialize the existing ContextVar from it, retaining reset in `finally:88`. Backend forwarding alone cannot close this gap. Keep context active for stream and inherited background work. |
| Upload → queue → worker | Queue payloads at `documents.service.ts:53-58,116-121` lack correlation; worker generates UUID each attempt at `document.processor.ts:27` | Persist ingress `request_id` and a generated `job_correlation_id` as metadata in both enqueue paths; reuse across retries, add numeric attempt. Legacy jobs need a generated ID persisted once, not regenerated each retry. Never dump `job.data`. |
| Worker → RAG | `document.processor.ts:38` passes ID; `rag.service.ts:12,22` forwards it and defaults to UUID for other callers | KEEP existing parameter/header/fallback. Validate context before use; reuse it rather than adding another correlation system. |
| RAG ingress | `rag-service/src/ragcore/logging_utils.py:108-110,165` validates a single header, sets/resets ContextVar | KEEP: already accepts UUID hex and hyphenated Backend UUIDs with the rule above. |
| Agent → RAG | `agentcore/memory/memory.py:130,319`, `agentcore/tools/knowledge.py:29` forward existing ContextVar | KEEP; once Agent ingress adopts Backend ID, embed/search calls correlate automatically. |
| Agent → Backend callbacks | Header blocks in `agentcore/memory/memory.py:144,173,336,365`, `tools/notes.py:28,88`, `tools/tasks.py:38,105`, `tools/pdf_generator.py:278`, `skills/skill_loader.py:77,98` omit request ID | Separate Agent follow-up: forward existing ContextVar on these internal calls so memory/tools/skills requests remain linked. Do not forward it to unrelated public websites. |

Return the validated/generated ID in Backend `X-Request-ID` before headers flush, including rejection paths. Expose that response header through CORS if browser clients need to read it (currently no `exposedHeaders`, `main.ts:12-15`). No RAG response-header echo currently exists or is required for its inbound correlation. Explicit request metadata/parameters and persisted job metadata suffice; avoid a new context framework or request-scoped provider graph. Accepting caller IDs is correlation convenience, not proof that two calls belong to the same authenticated user.

Existing `backend/test/rag-correlation.test.cjs:14-47` covers forwarding, fallback IDs and no `console.log` calls on rejection/timeout. It does not assert all logger channels or cover ingress validation, queue retries, Agent ingress or streaming completion; tests were inspected, not executed in this audit.

## Noise removal and review checks

Remove file/stream dumps, hit-only messages and commented dumps first. Collapse current Agent status log plus rethrow/default exception output into one safe request failure. Do likewise for storage and enqueue errors. Keep one request terminal outcome, one worker terminal outcome per attempt, and aggregate DEBUG stages; no per-chunk, per-record, per-vector or tool-result events. Routine health/start events should not flood INFO. RAG's own ingestion outcome and Backend's job completion represent different boundaries and may both remain.

Before implementation approval, review the event/field allowlists and the small Agent ingress/callback follow-up. After implementation, verify missing/invalid/duplicate IDs, concurrent requests, retries, auth/validation/throttle rejection, upstream timeouts/5xx, persistence failure, stream disconnect and error-after-headers. Capture logs with sentinel secrets/content and assert absence; assert exactly one terminal event per request/attempt and production DEBUG suppression. This audit made no application/configuration/test changes, ran no services/tests, and performed no commit or push.
