# Priora MindCloud Server-Side Production Readiness Review

## Scope

Review date: 2026-09-26. Source baseline: `ddef5834dc67427501a1914bccf3ff23041f0907`.

This review covers the NestJS backend (`backend/src`), Python Agent service (`agent-service/src/agentcore`), Python RAG service (`rag-service/src/ragcore`), PostgreSQL / Prisma schema and migration, Supabase Storage, Qdrant, Ollama / LLM integration, and inter-service communication. It includes all implemented application endpoints and registered Agent tools, document ingestion/deletion, conversation persistence, authentication, authorization, and failure recovery.

This is REVIEW + ANALYSIS + REPORT ONLY. No implementation, schema, configuration, dependency, or test files were changed. Recommendations below are proposed work, not implemented controls.

Evidence comes from implementation inspection, installed dependency inspection, read-only TypeScript checking and Jest execution, Python syntax parsing, and isolated probes using synthetic data and mocked dependencies. No requests were sent to the configured databases, storage buckets, Qdrant, or LLM. No real user records were read or modified. Deployment firewall rules, TLS termination, Supabase bucket policies/Data API grants, database backup/restore, live migration status, and actual infrastructure quotas remain unverified. Absence of these settings in the repository is not proof that the deployed infrastructure lacks them.

The feature plan and architecture documents were treated as intent, not implementation evidence. For example, the current document list exists but differs from the plan, and the documented document retry endpoint is not implemented. File references below are relative to the repository root; named functions identify the reviewed code.

## Executive Summary

**The current system is not safe for a multi-user production deployment.** Two concrete confidentiality defects are release blockers: an unscoped conversation-list query and Agent history retained across failed requests. Failure safety also needs work: a whitespace chunk can loop forever, ingestion can remain PROCESSING indefinitely, document deletion leaves searchable vectors, and side-effect tools can succeed without a durable record of the chat that caused them.

There are useful foundations: JWT signature/expiry verification and user existence checks, ownership checks on most CRUD paths, DTO allowlists, PostgreSQL foreign keys/enums, deterministic chunk IDs, Qdrant dimension/distance checks, and a ten-iteration Agent limit. These controls do not yet compose into a fail-safe system.

| Area | Status | Risk | Main Finding |
|------|--------|------|--------------|
| Explicit State | ISSUE | HIGH | Document states exist, but no recovery for abandoned PROCESSING; chat/tool executions have no durable attempt state. |
| Validation | ISSUE | HIGH | RAG accepts raw dictionaries; Agent tool schemas disagree with executable signatures; upload and response validation are incomplete. |
| Permissions | ISSUE | CRITICAL | Missing conversation filter can expose all users' conversation metadata; failed Agent history can cross users. |
| Failure Handling | ISSUE | HIGH | Chunker can loop forever; unhandled tool/LLM errors and partial ingestion are not recovered safely. |
| Retries & Timeouts | ISSUE | HIGH | AGENT_TIMEOUT_MS is read but unused; most calls have no application deadline. |
| Idempotency | MISSING | HIGH | Creation/message/tool requests can duplicate committed effects after retries or lost responses. |
| Observability | ISSUE | HIGH | Sensitive content is printed; no correlated cross-service request trace or stage metrics. |
| Evals / Testing | MISSING | HIGH | No committed unit/contract/Agent/RAG suites found; sole scaffold E2E fails before running. |
| Rate Limits | MISSING | HIGH | No application limiter on login, chat, uploads, tools, ingestion, or search. |
| Cost Limits | PARTIAL | HIGH | Ten Agent iterations, topK=5 in one caller, and Qdrant batches exist; input/history/tool/document budgets do not. |
| Versioning | PARTIAL | MEDIUM | API prefix, SQL migration, vector metadata exist; model/chunk/prompt/tool compatibility is not enforced. |
| Security | ISSUE | CRITICAL | Confidentiality defects, unauthenticated Python boundaries, sensitive logging, and a committed token literal. |
| Concurrency | ISSUE | HIGH | Shared Agent state, unordered concurrent chat turns, and uncoordinated vector/document writes. |
| Data Consistency | ISSUE | HIGH | Storage, database, vector writes, and Agent effects can diverge after partial success. |

Risk reflects the concrete consequence, not implementation effort. CRITICAL is reserved for the two reachable cross-user confidentiality paths. Python endpoint exposure is a HIGH deployment gate because external reachability was not established.

## 1. Explicit State

### Finding S1 — Document state cannot reliably converge

Status: ISSUE  
Risk: HIGH  
Service: NestJS / RAG / PostgreSQL  
Relevant file/function: `backend/prisma/schema.prisma` (`DocumentStatus`); `backend/src/documents/documents.service.ts` (`upload`, `remove`); `rag-service/src/ragcore/main.py` (`ingest`).

Current behavior: A row defaults to PROCESSING after storage upload. Successful RAG HTTP/JSON completion causes READY. An exception inside the ingestion/READY-update block attempts FAILED. Storage upload and row creation occur outside this catch. Deletion is permitted regardless of status. RAG has no persisted ingestion attempt state.

Failure / risk: A hung RAG call, process termination, or failed FAILED update can leave PROCESSING forever. A failed READY update can produce FAILED with complete vectors. A successful but semantically invalid RAG response can produce READY without useful vectors. There is no retry/re-ingestion route, attempt identifier, expiration, chunk-count invariant, or restart reconciliation. Returning 400 after persisting FAILED does not remove that row or its storage object.

Smallest recommended fix: Persist attempt ID, start/deadline, safe error code, and expected/committed chunk count; bound ingestion; reconcile expired PROCESSING attempts; permit an owned, idempotent FAILED-to-PROCESSING retry on the same document. Require a validated committed-ingestion result before READY. Do not add a distributed workflow framework for this.

| Workflow | Implemented states/transitions | Missing or unsafe transition |
|---|---|---|
| Document | absent -> storage only -> PROCESSING -> READY or FAILED; any existing row -> deleted | Storage-only orphan has no state; interrupted processing has no recovery; READY/FAILED do not prove vector state; no FAILED -> PROCESSING API. |
| RAG ingestion | Implicit download -> parse -> chunk -> embed -> upsert batches -> return | No durable running/committed/failed generation; earlier batches survive a later failure. |
| Conversation/message | Conversation exists; messages have USER/ASSISTANT roles only | Roles are not execution states. Nothing records accepted/running/failed/tool-committed chat attempts. |
| Agent | In-memory messages + step counter; normal return or exception | No durable execution status; exhausted loop returns a tool message; exception skips cleanup. |
| Task | PENDING default; PATCH may set PENDING/PROGRESS/COMPLETED/CANCELLED | All enum-to-enum transitions are accepted. No business transition policy, but none is required by the implemented CRUD contract. AGENT executor is metadata, not a worker. |
| Notes/MindSpaces | Existence and timestamps | Appropriate for simple CRUD; execution state is only needed around multi-step side effects, not every entity. |

### Finding S2 — Chat success and tool success are separate, unrecorded states

Status: MISSING  
Risk: HIGH  
Service: NestJS / Agent  
Relevant file/function: `backend/src/conversations/conversation-messages.service.ts:create`; `agent-service/src/agentcore/agent.py:Agent.run`.

Current behavior: Fetch history, run Agent and any tools, then persist the USER/ASSISTANT pair with `createMany`. There is no pending message or execution record before tools run.

Failure / risk: A tool can commit a task/note, then a later LLM error or message persistence failure produces a failed chat with no record of its effects. The pair is a single database bulk write, which is a positive local atomicity property; it does not include prior tool commits.

Smallest recommended fix: Record a client-keyed chat attempt before execution, with running/succeeded/failed outcome and durable tool operation IDs/results. Keep the final message pair atomic. Expose a recoverable outcome for a lost response rather than rerunning the Agent blindly.

## 2. Validation

### Finding V1 — Backend validation is uneven at actual HTTP boundaries

Status: PARTIAL  
Risk: HIGH  
Service: NestJS  
Relevant file/function: `backend/src/main.ts`; controllers and DTOs under `auth`, `mindspaces`, `conversations`, `notes`, `tasks`, `documents`.

Current behavior: Global `ValidationPipe` enables transform, whitelist, and rejection of extra DTO fields. A second default pipe is redundant. Auth validates email/password (minimum password length 5); creation DTOs validate MindSpace UUIDs; task enums are validated. Notes/tasks list queries and task resource paths use `ParseUUIDPipe`. Other resource paths do not. Conversation listing reads `query.minspaceId` from `any`; document listing accepts an optional unchecked string. Most strings have no maximum length; `IsNotEmpty` runs before service trimming.

Failure / risk: Missing conversation scope becomes an authorization defect (P1). Missing document scope lists all documents owned by the caller, not all users' documents, and invalid/unowned scope yields an empty list instead of an explicit rejection. Whitespace titles/content can become empty after trim. Object/array query parameters can reach Prisma as malformed filters. Invalid path IDs generally produce 404 against TEXT IDs, but are not consistently rejected as malformed. Note/task update DTOs explicitly reject null; MindSpace/conversation partial DTOs do not have that same policy.

Smallest recommended fix: Require UUID scope/path inputs consistently; use an owner predicate in the final query regardless of prechecks; trim before validating nonblank values; set practical per-field lengths; retain existing DTO allowlists and enum handling. Remove the duplicate global pipe as cleanup.

### Finding V2 — Upload checks are insufficient before buffering and processing

Status: ISSUE  
Risk: HIGH  
Service: NestJS / RAG  
Relevant file/function: `documents.controller.ts:uploadFile`; `documents.service.ts:upload`; `storage.service.ts:upload`; `ragcore/pdfExtractor.py:extract`.

Current behavior: `FileInterceptor("file")` has no configured Multer limits. Service code dereferences `file.buffer` without a missing-file check and verifies only the first five bytes `%PDF-`. It stores client MIME and filename. RAG parses with `PdfReader` and extracts every page.

Failure / risk: Missing file produces an unhandled TypeError/500. A PDF prefix alone does not establish a valid, safe-to-process PDF. MIME is not enforced or normalized; upload size, page count, extracted characters, and processing time are unbounded in application code. A large or pathological PDF can exhaust memory/CPU. The whole file is buffered before the service-level ownership check; JWT auth still precedes the interceptor.

Smallest recommended fix: Configure byte/part limits at upload parsing, reject missing files, verify the signature, normalize stored content type, and bound PDF pages/text/time. Treat malformed/encrypted/nonextractable PDFs as explicit validation failures. Extension/MIME checks may supplement parsing but must not replace it. Process untrusted PDFs under resource limits; antivirus infrastructure is not assumed necessary for V1 without a serving/download use case.

### Finding V3 — Agent input, tool schema, and result contracts are incomplete

Status: ISSUE  
Risk: HIGH  
Service: Agent / NestJS  
Relevant file/function: `agentcore/schemas.py:ChatRequest`; `agent.py:run`; `tools/tasks.py`; `tools/notes.py`; `tools/knowledge.py`; `backend/src/agent/agent.service.ts:runAgent`.

Current behavior: ChatRequest requires strings and a list but does not bound strings/history or validate nested history roles/content, UUIDs, token authority, or unexpected fields. Tool execution is `registry.get(name)(**arguments)` without argument validation. `createTask` is registered twice: once as a callable and once as a JSON schema requiring `mindSpaceId`, although the Python callable does not accept that argument. Tools source active MindSpace/token from ContextVars. HTTP results are mostly raw response text. NestJS only tests `data?.content?.trim()`.

Failure / risk: An unknown tool calls None; wrong argument keys/types fail at runtime; the explicit task schema can cause an unexpected-keyword TypeError. Function annotations do not validate runtime values. A malformed non-string Agent content can itself fail the NestJS trim check. A response with role=tool can pass content validation and be stored as ASSISTANT. Raw tool HTTP error text may be interpreted as a successful operation by the LLM. Direct Agent callers can supply system/tool roles in history.

Smallest recommended fix: Use one executable schema per tool, keep identity/scope out of model-controlled arguments, validate arguments before calling, and return bounded typed success/error results. Validate incoming history and outgoing assistant response explicitly. Reject blank final answers and distinguish step exhaustion from successful completion.

### Finding V4 — RAG and configuration validation stop too late

Status: ISSUE  
Risk: HIGH  
Service: RAG / all service configuration  
Relevant file/function: `ragcore/main.py:ingest,search`; `chunker.py`; `qdrant_client.py:validate_chunk,map_chunks_to_points`; both Python `config.py` files; NestJS `app.module.ts`, `prisma.service.ts`, `.env.example` files.

Current behavior: RAG manually reads JSON keys and converts `topK` with `int`. No request model checks storageKey, source_id, mindSpaceId, query, or topK range. Chunk checks cover dictionary shape, required keys, nonempty IDs, and source_type; mapping checks counts/dimensions. They do not explicitly validate chunk text, page/index types, finite vector values, tenant IDs, or extracted text. Chunk-size/overlap relationships are unchecked. Some configuration is required via getOrThrow/int conversion; there is no complete startup schema.

Failure / risk: Missing/malformed JSON keys or topK produce 500 instead of stable 4xx; huge topK can create expensive responses; arbitrary storage/source/tenant combinations reach ingestion. Invalid text can crash extraction/chunking. Missing BACKEND_SERVICE_URL causes import-time string concatenation failure. Missing RAG integer settings fail import; wrong positive ranges, URL paths, model settings and secret values are not checked coherently. NestJS DATABASE_URL uses a TypeScript assertion rather than runtime validation.

Smallest recommended fix: Add bounded Pydantic ingestion/search models and explicit chunk/text checks; require `0 <= overlap < chunk_size`; validate configuration once at startup with safe errors. Derive storage/source/tenant binding from authorized document metadata rather than trusting three independent strings.

Database constraints are a useful second boundary: primary keys, unique user email, foreign keys, enum statuses, NOT NULL, and cascade deletes exist in the committed initial SQL migration. IDs are TEXT; there are no UUID CHECKs, nonblank/length CHECKs, idempotency constraints, or unique `(userId, name)` for MindSpaces. Do not mistake application checks for database uniqueness.

## 3. Permissions

### Finding P1 — Conversation listing can return other users' metadata

Status: ISSUE  
Risk: CRITICAL  
Service: NestJS / Prisma  
Relevant file/function: `backend/src/conversations/conversations.controller.ts:42` (`findAll`); `conversations.service.ts:23` (`findAll`).

Current behavior: Controller reads misspelled `query.minspaceId`. Service checks `mindSpace.findFirst({where:{id:minspaceId,userId}})`, then queries conversations with only `{mindSpaceId:minspaceId}`. If the parameter is omitted, or correctly spelled `mindSpaceId`, it is undefined. The first query can find any MindSpace owned by the caller; the second query loses its only filter.

Failure / risk: An authenticated user with at least one MindSpace can receive all conversation records, including other users' titles, IDs, MindSpace IDs and timestamps. Message content is not included by this list query; separate message endpoints still check ownership. The frontend currently sends the misspelled parameter, hiding the issue in the ordinary happy path.

Evidence: An isolated probe executed the actual controller/service after in-memory transpilation with mocked Prisma; the final query serialized as `{"where":{},"orderBy":{"updatedAt":"desc"}}`. Installed Prisma serialization omits undefined fields and the generated client has `previewFeatures: []`. This agrees with [Prisma's documented undefined behavior](https://docs.prisma.io/docs/orm/prisma-client/special-fields-and-types/null-and-undefined). No live database exploit was attempted.

Smallest recommended fix: Require and UUID-validate the agreed query key; include `mindSpace: {userId}` in the final `findMany` as well as the exact MindSpace ID. Update the frontend contract together if correcting the spelling. Add missing, misspelled, malformed, and cross-user query tests.

### Finding P2 — Failed Agent request history crosses the user boundary

Status: ISSUE  
Risk: CRITICAL  
Service: Agent  
Relevant file/function: `agent-service/src/agentcore/main.py:10,29`; `agentcore/agent.py:Agent.run`.

Current behavior: A module-global Agent holds `self.messages`. `run` appends the new prompt/history to the existing list. `/chat` clears that list only after normal completion.

Failure / risk: Any LLM/tool exception leaves the first caller's conversation and possibly retrieved documents/notes/tasks in memory. The next caller on that worker sends that residual content to the LLM along with their own request. This is a sequential cross-user leak, not dependent on simultaneous threads. It can also cause actions influenced by the previous user's instructions while tools use the new request's credentials.

Evidence: A synthetic LLM exception followed by a second run of the actual Agent class confirmed that the second LLM invocation sees the first user's marker. No real content was used.

Smallest recommended fix: Make messages/Agent state request-local; clean up in finally as defense in depth; reset ContextVar tokens in finally. Add a two-user failure-then-success regression before deployment. A global lock alone does not fix retained state.

### Finding P3 — Python services trust caller-supplied context without service authentication

Status: ISSUE  
Risk: HIGH  
Service: Agent / RAG  
Relevant file/function: `agentcore/main.py:chat`; `ragcore/main.py:ingest,search`; `tools/knowledge.py`; `qdrant_client.py:search`.

Current behavior: Python endpoints have no authentication dependencies/middleware. Agent takes accessToken/mindSpaceId/history in its body. Note/task tools forward the token to guarded NestJS endpoints, but searchKnowledge forwards only the MindSpace ID to RAG. RAG filters vectors by exact mindSpaceId but never proves ownership or verifies ingestion metadata against a document record.

Failure / risk: Anyone able to reach RAG can select another MindSpace for retrieval, use privileged storage download through a supplied storage key, or write vectors attributed to arbitrary scope/source. A direct Agent caller can select RAG scope without a valid user token. Deterministic point IDs depend on source_id/index, not tenant, so forged reuse of source_id can overwrite other points. Actual public reachability is unverified; loopback defaults are not an authorization control for every deployment.

Smallest recommended fix: Restrict Python service ingress and authenticate service callers. Carry a verified, authorized scope from NestJS through Agent to RAG; RAG must accept scope only from that trusted boundary. Bind ingestion to document ID/storage key/MindSpace and reject inconsistent metadata. Do not treat a shared service token alone as proof of end-user ownership when arbitrary user calls can supply the body.

Endpoint and tool coverage follows. All NestJS routes below have `/api/v1` prefix.

| Endpoint/tool | Actual authorization and isolation | Assessment |
|---|---|---|
| POST auth/register, auth/login | Public by design; DTOs; unique email/Argon2 | No limiter; registration race addressed later. |
| GET auth/me | JwtGuard -> signature/expiry -> DB user lookup | Does not return password hash; logs JWT claims. |
| GET users | JwtGuard; returns literal `hopa` | Placeholder, no user-data disclosure; remove from public contract if unused. |
| GET root | Public `Hello World!` | Liveness-like response only. |
| MindSpaces POST/GET/PATCH/DELETE | JWT-derived userId; owned filters on read/update/delete | Ownership present; no compound uniqueness; delete cascades relational rows only. |
| Conversations POST | Owned MindSpace check | Validated create UUID; FK handles parent deletion race. |
| Conversations GET collection | Precheck owner; final query depends on unchecked optional scope | P1 blocker. |
| Conversations GET/PATCH/DELETE by ID | Filter through mindSpace.userId before action | Owner isolation present; path UUID validation missing. |
| GET/POST conversations/:id/messages | Owned conversation check, including history read; scope derived from conversation | Direct cross-user access rejected; Agent state/effects remain unsafe. |
| Notes POST/list/by-ID/PATCH/DELETE | Owned MindSpace or note->MindSpace->user predicate | No ownership reassignment in update DTO; list UUID checked, resource paths unchecked. |
| Tasks POST/list/by-ID/PATCH/DELETE | Same owned checks; query/path UUIDs checked | Update cannot move task; executor does not grant extra execution privilege. |
| Documents POST | Guard, UUID body, owned MindSpace before storage write | File parsing/buffering occurs earlier; no size limit. |
| Documents GET | Final query includes mindSpace.userId | Omitted scope broadens only within caller's documents; returns storageKey. |
| Documents DELETE | Owned document check before storage/row removal | No vector cleanup; no path UUID parser. |
| NestJS AgentController | No route handlers | An unguarded empty controller does not expose an action. |
| Agent /chat | No HTTP auth; context from body | P2/P3; no independent scope validation. |
| RAG /v1/ingest, /v1/search | No HTTP auth; body-selected storage/source/scope | Exact vector filter exists but is not authorization. |
| Python /health, /v1/health | Public static status | Reasonable liveness; not readiness. |
| createNote/createTask | ContextVars -> bearer JWT -> NestJS ownership checks | Model cannot override scope in callable; no action idempotency or intent gate. |
| getAllNotes/getAllTasks | Same JWT and scope forwarded to NestJS | Ownership enforced there; result content unbounded. |
| searchKnowledge | Context MindSpace -> unauthenticated RAG | Scope vulnerable at Python ingress, not model tool argument. |
| getTime | Fixed timezone allowlist; no network | Unsupported location returns text; arguments still need validation. |
| getWeather | Returns a fixed invented weather sentence | No external provider or authorization requirement; should not be presented as real weather. |

## 4. Failure Handling

### Finding F1 — Whitespace chunk input can block the RAG worker indefinitely

Status: ISSUE  
Risk: HIGH  
Service: RAG  
Relevant file/function: `rag-service/src/ragcore/chunker.py:22-42`, `Chunker.chunk`.

Current behavior: `start = end - overlap` is inside `if chunk`. A whitespace-only slice strips to empty, so the loop never advances. This can happen on a whitespace page or a sufficiently long whitespace segment/tail of an otherwise valid extraction.

Failure / risk: Infinite CPU loop blocks the synchronous work inside the async RAG endpoint. Other requests, including health on that worker, cannot run. NestJS waits indefinitely and the document stays PROCESSING. This is distinct from a request exception; timeouts in an HTTP caller alone do not stop the CPU loop.

Evidence: The actual Chunker with `page_text='     '` exceeded a two-second isolated subprocess deadline; the probe killed only its own child. Normal text terminates.

Smallest recommended fix: Advance on every iteration, validate size/overlap, reject no-useful-text documents, and put ingestion under a processing budget. Add whitespace-page/tail cases, not only ordinary text tests.

### Finding F2 — Errors either escape or become misleading success/client errors

Status: ISSUE  
Risk: HIGH  
Service: All three services  
Relevant file/function: NestJS `AgentService`, `DocumentsService`, `StorageService`; Python `Agent.run`, tool HTTP functions, `ragcore/main.py`.

Current behavior: Exceptions are handled inconsistently across service boundaries, as mapped below.

Failure / risk: Depending on the stage, the caller receives a generic error, a misleading client error, a raw tool result, or no response; committed side effects can remain. Specific outcomes follow.

| Failure point | Current / user-visible behavior | State and inconsistency | Exception / detail exposure |
|---|---|---|---|
| DB connection/query failure | Startup fails on connect or request usually 500 | No operation-specific recovery; prior external effects remain | Uncaught Prisma errors normally become generic NestJS 500; server logs may include internals. |
| Duplicate email race | Both prechecks can pass; unique index rejects one create | No duplicate email row | Unmapped Prisma error -> 500 instead of 409. |
| Storage upload error | StorageService throws generic 400 | Normally no row; ambiguous response loss may leave object | Safe but misleading client-error classification. |
| Document row create after upload fails | Unhandled 500 | Orphan file; no compensating delete | Generic response, internal exception logging possible. |
| Agent unavailable/non-2xx/invalid JSON | Generic 500 from uncaught error | No message pair; tools may already have committed on late failures | Non-2xx body not reflected directly. |
| Empty Agent content | Explicit error -> 500 | No pair; earlier tools unaffected | Non-string content can throw TypeError; role unvalidated. |
| LLM unavailable/timeout/malformed response | Uncaught Python exception -> Agent 500 -> NestJS 500 | Shared history retained; prior effects survive | No app debug mode enabled; default client response usually generic, logs expose context. |
| Empty LLM text without calls | Agent returns empty assistant result; Nest rejects | No pair; shared state clears on normal Agent return | No user-facing distinction from infrastructure failure. |
| Unknown tool / invalid arguments | None-call or TypeError -> Agent 500 | Prior tool results/effects retained; history not cleared | Raw server traceback; no stable tool error contract. |
| Tool non-2xx HTTP | Notes/tasks return response.text as ordinary result; RAG tool parses JSON without status check | LLM may claim success or use error payload as data | Backend error text can reach model/final answer/logs. |
| Tool connection failure/non-JSON RAG result | Exception -> Agent 500 | Earlier writes are not undone | No structured failure result. |
| Repeated tools/MAX_STEPS | Ten iterations then last message returned | Up to many side effects; final tool data can be persisted as assistant | Raw tool output may become user-visible. |
| RAG missing/malformed request data | JSON/key/type/conversion exception -> 500 | Usually no writes yet | No consistent validation response. |
| Download failure / missing object | Exception -> RAG 500 -> Nest attempts FAILED and returns 400 | File/row retained; retry route absent | RAG error is logged; Nest response is generic. |
| Corrupt/encrypted PDF / extraction error | Same failure chain | No new vectors if before upsert | Parser exceptions uncaught in RAG. |
| Empty/scanned PDF | No explicit rejection; zero chunks may produce embedding error or zero-point success | If embedding returns empty list, upsert does nothing and Nest can mark READY | Model/version dependent zero-input behavior; not live-tested. |
| Chunking whitespace stall | Never returns | PROCESSING persists, worker unavailable | No exception to catch. |
| Embedding/model failure | RAG 500 or process startup failure | File/row retained; old vectors may remain on re-ingestion | Model errors logged, no safe stage code. |
| Qdrant unavailable/search error | RAG 500; Agent may treat JSON error as result or fail JSON parsing | Retrieval unavailable; no data rollback needed for search | No explicit unavailable tool result. |
| Qdrant later batch write failure | RAG 500, document FAILED if DB available | Earlier batches remain searchable | No generation publication boundary. |
| READY DB update failure | Caught as "RAG ingestion failed"; tries FAILED | Complete vectors + FAILED, or PROCESSING if second update fails | Wrong stage attribution; second error masks original. |
| Storage deletion succeeds, DB deletion fails | 500 | DB document remains but file is gone; vectors remain | No recovery marker. |

Smallest recommended fix: Use a small set of safe stage-specific error codes with correct 4xx/502/503/504 mapping; validate downstream results; catch tool failures as typed failures; ensure per-request cleanup. Add recovery only where side effects already occurred. Ordinary uncaught exceptions fail requests, not necessarily whole processes; OOM, startup failure and the infinite loop can affect service availability.

## 5. Retries and Timeouts

### Finding T1 — Timeout configuration is largely ineffective or implicit

Status: ISSUE  
Risk: HIGH  
Service: All external boundaries  
Relevant file/function: Network calls listed below; `backend/src/agent/agent.service.ts` reads but never uses `AGENT_TIMEOUT_MS`.

Current behavior: No application retry loops were found. For each row below, application retry count is **0**, retry delay/backoff **none**, and application retryable-error classification **none**. This describes the application, not an assertion about every transport/provider internal retry. Installed Storage/Ollama implementations were inspected where noted.

| External/network call | Timeout as implemented | Retry safety and smallest policy |
|---|---|---|
| NestJS -> PostgreSQL, PrismaPg `$connect` and all CRUD | No explicit connection/statement/query budget; installed pg defaults include disabled statement/query timeout and zero connect_timeout | Read-only transient reconnect may be retried within a deadline; do not replay ambiguous creates. Bound pool/connection/query time. |
| NestJS -> Agent, fetch POST | Timeout setting read but no AbortSignal; runtime transport defaults are not a total run deadline | No blind retry: a tool may have committed. Retry only by durable chat operation key/result lookup. |
| NestJS -> RAG ingest, fetch POST | No AbortSignal; hardcoded `http://localhost:8800/v1/ingest` | No blind retry until same-document/generation deduplication and reconciliation exist. |
| NestJS -> Supabase upload/remove | No app deadline/custom abort; inspected storage-js fetch path makes a single fetch | Upload response loss is ambiguous. Reconcile deterministic storage key; retry delete as convergent cleanup, not whole upload. |
| Agent -> NestJS createTask/createNote, requests.post | No timeout argument (requests has no default request timeout) | Writes require operation keys before retry; distinguish 401/403/validation from transient 5xx. |
| Agent -> NestJS getAllTasks/getAllNotes, requests.get | No timeout argument | At most a small bounded retry of connection/reset/502/503/504; never retry validation/authorization blindly. |
| Agent -> RAG searchKnowledge, requests.post | No timeout argument | Semantically read-only; bounded transient retries safe for data, but consume embedding/CPU work. |
| Agent -> Ollama `ollama.chat` | No app timeout; installed Ollama client defaults timeout=None | Bounded retry may be safe before any tools execute, but costs another generation. Never rerun entire tool-bearing conversation blindly. |
| RAG -> Supabase download | No app setting; installed supabase-py imports storage3 default **20 seconds** | A read can use a small transient retry budget; 404/auth/invalid key are not transient. This is an SDK operation timeout, not an ingestion deadline. |
| RAG -> Qdrant list/create/index/get/upsert/query | Explicit **60 seconds** per client request | Search/get can retry transient errors. Same deterministic point upsert can converge, but partial generations and stale chunks need correction first. Reconcile concurrent collection-create conflicts. |
| RAG -> model repository on SentenceTransformer initialization | May download on cold cache; no application startup/download budget or pinned revision | Pre-cache/pin model for deployment; startup retrieval policy belongs to artifact preparation, not user request retry. |
| RAG embedding `.encode` | Local computation, not a remote LLM call | Network retries do not apply; bound work, pages/chunks, concurrency and wall-clock budget. |

Failure / risk: Hanging tools/LLM/ingest can occupy workers indefinitely. A single run can execute ten LLM calls and multiple tool calls per iteration with no total deadline. Aborting the NestJS request alone does not cancel synchronous Python work or undo committed actions.

Smallest recommended fix: Configure explicit deadlines per hop and an end-to-end execution budget; use requests connect/read timeouts, an explicit Ollama client, and AbortSignal in NestJS. Validate numeric timeout settings. Make downstream budgets shorter than the caller budget and check remaining time between steps/batches. After idempotency exists, consider at most two additional attempts with short exponential backoff/jitter for read-only transient connection failures and 502/503/504; honor bounded Retry-After for 429. Do not retry 400/401/403/404/422, deterministic parser/schema/dimension failures, or permanent configuration faults. Writes with unknown outcomes must reconcile, not simply repeat.

### Finding T2 — Service URL examples do not match implemented routes

Status: ISSUE  
Risk: MEDIUM  
Service: NestJS / Agent / RAG  
Relevant file/function: `backend/.env.example`; `backend/src/agent/agent.service.ts`; `backend/src/documents/rag.service.ts`; `agentcore/config.py`, `tools/knowledge.py`; `agent-service/.env.example`.

Current behavior: NestJS posts to AGENT_SERVICE_URL verbatim; its example omits `/chat`. Agent's default RAG_SERVICE_URL ends `/api/v1`, then searchKnowledge appends `/v1/search`, although RAG exposes `/v1/search`. The Agent example has a scheme-less RAG URL and incomplete backend URL. Backend needs Supabase URL/key absent from its example; no RAG `.env.example` was found. NestJS RAG URL is hardcoded.

Failure / risk: Following examples can cause startup failure, invalid URL errors, or 404 rather than a working service mesh. Current private environment values were not inspected, so this is a reproducibility/configuration finding, not proof the live setup uses those defaults.

Smallest recommended fix: Define each URL as either base URL or full endpoint consistently, validate at startup, and provide complete non-secret examples. Check endpoint contracts in a local mocked smoke test.

## 6. Idempotency

### Finding I1 — Most side effects lack a stable operation identity

Status: MISSING  
Risk: HIGH  
Service: NestJS / Agent / RAG  
Relevant file/function: Creation services; `ConversationMessagesService.create`; `DocumentsService.upload`; `Agent.run`; `Chunker.chunk`; `QdClient.upsert`.

Current behavior and smallest practical fixes:

| Operation | Current protection | Duplicate/unknown-outcome risk | Smallest practical fix |
|---|---|---|---|
| Registration | Unique normalized email | No duplicate row, but concurrent second attempt can return 500 | Map unique conflict to safe 409; no generic idempotency layer needed. |
| Create MindSpace | Read-before-write same-name check | Concurrent requests both pass; no compound unique constraint | Unique userId/normalized-name if name uniqueness is intended; map conflict. |
| Create conversation | Random DB ID | Double click/retry creates another conversation | Client-generated operation key scoped to user/action. |
| CreateTask/CreateNote through API or Agent | Ownership checks only | Repeated model call/client retry/lost response creates duplicates | Persist unique user/action/operation key and request hash with result; tool derives key from durable chat attempt + logical operation. |
| Send message | Single bulk insertion of pair | Duplicate Agent executions and message pairs; possible duplicate tools | Unique client message/attempt ID, in-progress conflict handling, replay stored result. |
| Upload document | Fresh random storage path; storage overwrite not requested | Retry creates another object, document and vector set | Reserve document/upload operation identity first; stable path; replay/reconcile prior outcome. Content hash alone must not forbid intentional duplicate uploads. |
| RAG ingestion same source/content | UUID5(source_id:index), Qdrant upsert | Same point IDs converge, but partial writes, concurrent changed content, stale tail chunks remain | Serialize/claim generation; publish complete generation; delete obsolete points after success. |
| Re-ingestion | No NestJS action route; Python ingest can be called again | Shorter input leaves old higher-index points | Same source with explicit generation replacement and stale cleanup; retain authorization. |
| PATCH fields | Absolute assignment often converges | Concurrent updates lose changes; timestamps/order change | Optional expected updatedAt/version for conflicting edits; no blanket POST-style key needed. |
| DELETE resource | DB ID prevents duplicate records; repeated absent row -> 404 | Document cleanup spans systems; partial outcome persists | Make external cleanup repeatable and track completion; ordinary CRUD deletion need not pretend 404 is duplication. |

Failure / risk: The absence of automatic retries today does not prevent user retries, frontend retries, proxy response loss, or repeated Agent decisions. Deduplicating only a model-generated call ID is insufficient when a rerun invents a new ID for the same action.

Smallest recommended fix: Start with chat/tool writes and document upload. Use database uniqueness and stored operation outcomes, not in-memory flags or broad content equality. Reject reuse of a key with a different payload. Do not turn on mutation retries before this works.

## 7. Observability

### Finding O1 — Sensitive debug logs replace useful execution telemetry

Status: ISSUE  
Risk: HIGH  
Service: All services  
Relevant file/function: `jwt.strategy.ts:validate`; `documents.controller.ts`; `storage.service.ts`; `documents.service.ts`; `agent.service.ts`; `conversation-messages.service.ts`; `agentcore/agent.py`, `llm.py`, `tools/knowledge.py`; `ragcore/main.py`, `chunker.py`, `storage.py`, `qdrant_client.py`.

Current behavior: Nest logs JWT payload, uploaded Multer objects (including buffer), storage keys and Agent replies. Agent prints full history, LLM content/thinking/tool calls and retrieved HTTP bodies. RAG prints extracted pages, every chunk, query embeddings, search results and storage keys. Qdrant batch counts are printed. Bootstrap and default framework errors provide basic logs.

Failure / risk: Conversation, note/task and PDF content plus identity claims/storage locators enter logs. Log volume scales with document/history size. No request ID, execution/attempt ID, cross-service correlation header, structured stage/result, latency metric, or durable tool audit connects these prints. A direct active-token print was not found in the request path; the committed token literal is a separate finding. Logging arbitrary exception objects may reveal provider internals, so avoid assuming logs are sanitized.

Smallest recommended fix: Remove content/token/claim/file-object logging; use structured event records with requestId, attemptId, safe document/source IDs, stage, duration, count and safe error code. Propagate one correlation ID NestJS -> Agent -> tools/RAG and attach it to Qdrant operation logs. Record tool operation IDs/outcomes without full arguments/content. Keep restricted diagnostic logs separate from normal application logs.

### Finding O2 — Health responses are only liveness indicators

Status: PARTIAL  
Risk: MEDIUM  
Service: NestJS / Agent / RAG  
Relevant file/function: `app.controller.ts`; `agentcore/main.py:health`; `ragcore/main.py:health`.

Current behavior: NestJS root returns Hello World; Agent /health and RAG /v1/health return static status. RAG constructs model/storage/Qdrant clients at import; Prisma connects at startup. None verifies ongoing dependencies or reports version/readiness.

Failure / risk: A service can return healthy with an unavailable LLM, storage or vector store. Blocking Python work also blocks its async health route. No correlated request can currently be followed end to end.

Smallest recommended fix: Separate fast liveness from bounded readiness (configuration/model loaded, database and required dependency reachability), without an LLM generation per health check. Add counters for stale PROCESSING, ingestion failures, chat/tool failures and latency; a full tracing platform can wait.

## 8. Evals and Testing

### Finding E1 — Production-critical regression evidence is absent

Status: MISSING  
Risk: HIGH  
Service: All services  
Relevant file/function: `backend/package.json`; `backend/test/app.e2e-spec.ts`; `backend/test/jest-e2e.json`; both Python `pyproject.toml`; tracked source/test inventory.

Current behavior:

| Category | Existing evidence in this checkout | Coverage assessment |
|---|---|---|
| A. Unit tests | No backend src spec files; no Python test files found | Missing automated assertions for auth/DTO/state/ownership/Agent/chunking logic. |
| B. Contract tests | DTOs, Pydantic ChatRequest, manual JSON schemas are implementation, not tests | No tests joining Agent schema to callable, service URLs, response roles, RAG input/results. |
| C. Integration tests | No committed service/DB/storage/vector integration suite found | Partial writes, idempotency, ownership and isolation not demonstrated. |
| D. E2E tests | One scaffold Hello World test imports AppModule | Does not exercise production bootstrap prefix/pipes/CORS or user workflows; fails before assertions. |
| E. Agent evals | No committed dataset/harness found | Tool selection, correct arguments, multiple calls, MAX_STEPS, LLM/tool failure and prompt injection not covered. |
| F. RAG evals | No committed retrieval dataset/harness found | Correct/irrelevant/missing answers, tenant/source filtering, parsing and ingestion replacement not covered. |
| Manual testing | Tickets/specs describe scenarios and commands | Instructions are not executed evidence; historical checks cannot certify the present tree. |

Validation actually run for this review:

| Check | Result | Limits |
|---|---|---|
| `backend/node_modules/.bin/tsc.cmd --noEmit --incremental false` from backend | PASS, exit 0 | Typecheck only; not Nest build/startup or dependency availability. |
| `jest.cmd --runInBand --no-cache` from backend | FAIL, exit 1: no tests found; 52 source files checked | No unit tests passed. |
| `jest.cmd --config ./test/jest-e2e.json --runInBand --no-cache` | FAIL, exit 1: `Must use import to load ES Module: ... @nestjs/testing/index.js`; 0 tests | Reproduced infrastructure failure; not an application behavior verdict. |
| Python AST parsing | PASS: 13 Agent and 9 RAG Python source files | Syntax only; no dependency/model loading, type or runtime assurance. |
| Actual conversation controller/service with mocked Prisma | CONFIRMED final unscoped `where:{}` on correctly spelled query | No production DB access; installed serializer inspected separately. |
| Actual Agent class with synthetic failing/succeeding LLM | CONFIRMED previous failed user's history reaches next run | Isolated synthetic inputs, no real LLM. |
| Actual Agent with ten tool-only responses | CONFIRMED final returned role is `tool` | No external tools or side effects. |
| Actual Chunker with whitespace input in child process | CONFIRMED no completion within 2s; child terminated | Bounded reproduction, not a load benchmark. |
| Actual Chunker with shorter re-ingest input | CONFIRMED 3 old IDs vs 1 new ID, same first ID | Demonstrates ID layout; stale-tail consequence follows from upsert without delete. |

Failure / risk: Successful compilation does not cover confidentiality, recovery, resource exhaustion, or side effects. No lint success is claimed: the repository lint script uses `--fix` and was not run during review-only work. No live E2E, load test, package vulnerability audit, migration deploy, or infrastructure inspection is claimed.

Smallest recommended fix: Repair the existing Jest ESM configuration, then add a compact failure-focused suite: (1) two-user CRUD/list/query isolation, (2) failed Agent request then different user, (3) task schema/unknown args/status handling/MAX_STEPS, (4) tool commit followed by LLM/response failure and replay, (5) document fault injection at storage/DB/vector stages, (6) whitespace/empty/malformed/oversize PDF/text, (7) Qdrant partial batch/re-ingestion/deletion isolation, (8) timeout and duplicate/concurrent requests. A small pinned Agent eval set should cover no-tool, create/read, multi-tool, tool failure, and malicious retrieved text; a small RAG set should cover positive, no-answer, irrelevant and cross-MindSpace/source queries. Avoid a large benchmark platform before these regressions pass.

## 9. Rate Limits

### Finding R1 — Expensive entry points have no application admission control

Status: MISSING  
Risk: HIGH  
Service: NestJS / Agent / RAG  
Relevant file/function: `backend/src/main.ts`, `app.module.ts`, auth/conversation/document controllers; `agentcore/main.py`, `ragcore/main.py`.

Current behavior: No throttler, request quota, per-user concurrency gate, login-attempt limiter, tool budget per minute, ingestion semaphore, or embedding rate gate found. Ten Agent iterations are a per-run loop bound, not rate limiting. Infrastructure controls are unverified.

Failure / risk: Public login/registration can consume Argon2 CPU; authenticated users can flood chat and upload, accumulating storage/vectors and exhausting workers; directly reachable Python search/ingest can consume CPU without user authentication. No endpoint-specific limit protects a single worker from concurrent long jobs.

Smallest recommended fix: Add IP + account-key limits for auth and user-key limits for chat/uploads; cap concurrent Agent runs and ingestion jobs at measured safe capacities; keep Python ingress internal and authenticated. Enforce search topK/input limits and per-run tool limits. Return a clear 429/Retry-After where appropriate. A single-instance limiter/semaphore is sufficient initially; coordinate across instances only when deploying multiple replicas. Exact quotas should follow V1 traffic/load measurements, not arbitrary universal numbers.

## 10. Cost Limits

### Finding C1 — Existing bounds do not cap total work or memory

Status: PARTIAL  
Risk: HIGH  
Service: All services  
Relevant file/function: `Agent.run`; `ConversationMessagesService.findAll`; `tools/knowledge.py`; `PdfExtractor.extract`; `Chunker.chunk`; `Embedding.embed`; `QdClient.upsert`; upload/list controllers.

Current behavior: Agent normally makes at most ten LLM calls per request. Each response can contain multiple tool calls with no total tool count limit. Conversation history is loaded in full; notes/tasks lists and tool results are unbounded. No explicit input/output token settings are passed to Ollama. Model name is configurable with a local default. RAG tool sets topK=5, but direct search accepts arbitrary int. Chunks are 500 characters with 100 overlap, not tokens. Qdrant upserts batches of 50 after all chunks/vectors/points are already materialized. EMBEDDING_BATCH_SIZE is imported/configured but unused by encode; the library's own default batching remains in effect.

Failure / risk: Ten iterations can still carry huge histories/results and many effects. Local Ollama consumes CPU/GPU; remotely configured providers may add monetary cost. Large PDFs allocate file bytes, extracted text, chunks, embeddings and points; batch upserts do not cap these allocations. Unbounded list responses and repeated uploads drive database/storage/vector growth. Multipart upload is application-unbounded; ordinary JSON still has framework parser defaults, so it is inaccurate to call every HTTP body unlimited.

Smallest recommended fix: Bound chat message/history/result sizes, total tool calls, output generation and total run time. Cap upload bytes, pages, extracted characters and chunks before embedding; use configured embedding batch size with a total document budget. Require `1 <= topK <= configured maximum`. Add pagination to growing lists and per-user storage/document quotas. Set a small concurrency limit before considering larger workers or queues.

## 11. Versioning

### Finding VER1 — Partial version metadata does not enforce compatibility

Status: PARTIAL  
Risk: MEDIUM  
Service: All services  
Relevant file/function: NestJS `main.ts`; Prisma schema/migration; Python routes, prompts and tools; `ragcore/qdrant_client.py:ensure_collection,map_chunks_to_points,search`.

Current behavior: NestJS uses `/api/v1`, RAG `/v1`, Agent `/chat` without version. A single committed SQL migration matches the reviewed schema's core structures; live migration application is unverified. Qdrant payload records `schema_version=2`, embedding_model/dimension/environment plus active/approved. Existing collection size/cosine distance and vector length are checked. Search filters only MindSpace, not version/model/environment/active/approved/source. The environment argument is ignored in favor of module ENV. Prompt/tool schemas are source-controlled but have no runtime version/hash. Python and npm lockfiles exist; model revision is not pinned in application code.

Failure / risk: Same-dimension embedding-model changes pass collection validation but mix incompatible vectors; dimension changes fail until migrated. Chunk-size/overlap/extraction changes alter chunk meanings/IDs and can leave stale tail points on replay. Stored PDFs remain usable, but vectors require rebuilding after model/chunk/extraction changes. Schema flags imply publication/approval behavior that search does not enforce. Raw Qdrant responses expose library-shaped contracts to Agent, and tool duplicate schemas can change behavior unpredictably. Inconsistent base paths already break example integration (T2).

Smallest recommended fix: Pin an embedding revision and chunking version; check collection metadata and reject incompatible ingestion/search. For a changed model/chunk strategy, re-ingest into a fresh collection/generation, verify it, then switch and retire old vectors. Define minimal typed versioned service responses; log prompt/tool version hashes. Keep SQL migrations reviewed and deploy them explicitly. Do not require a schema registry or elaborate API-version framework for V1.

## 12. Security

### Finding SEC1 — Good JWT/CRUD foundations do not close all trust boundaries

Status: ISSUE  
Risk: CRITICAL  
Service: NestJS / Agent / RAG  
Relevant file/function: P1-P3; `auth.service.ts`, `auth.module.ts`, `jwt.strategy.ts`; `main.ts`; `agentcore/config.py`.

Current behavior: Passwords are Argon2 hashed; login errors do not disclose which credential failed; JWT verification checks signature/expiration and that the user still exists. Lifetime is configurable (example 15m). No refresh/session revocation implementation exists; frontend logout does not revoke a issued JWT. Authorization generally follows Prisma ownership relations. CORS is an explicit localhost-only allowlist with credentials; it is not wildcard-open. Services use HTTP in defaults. A JWT literal is committed in Agent config; the active tools use ContextVars, not that constant. Environment files are ignored, but source literals are not protected by that rule.

Failure / risk: P1/P2 are immediate confidentiality blockers. P3 is a deployment trust-boundary gap. The token literal is credential material even though unused; actual validity/reuse was not tested and its value is deliberately omitted here. Weak/unvalidated JWT secret/lifetime configuration and minimum password length 5 are hardening gaps. CORS currently blocks normal production browser origins unless configured; it does not prevent nonbrowser access to Python services. No issuer/audience/algorithm allowlist is explicitly configured. No RLS/bucket-policy evidence establishes whether direct Supabase access is safe; custom NestJS JWTs do not by themselves prove any Supabase policy relationship.

Smallest recommended fix: Fix P1/P2 before deployment, then close Python ingress/scope boundaries, remove the token literal and revoke it if still usable; assess whether related credentials were exposed without automatically rotating unrelated secrets. Validate secret/lifetime configuration and strengthen password policy. Use production-specific CORS and TLS at the actual trust boundaries. Verify private bucket settings and Data API grants/RLS if these database tables are exposed through Supabase. A short-lived access-token-only V1 can be reasonable; do not add refresh-token infrastructure unless the product needs persistent sessions. Document the resulting logout/revocation limit.

### Finding SEC2 — Retrieved text can influence side-effect tools without an intent boundary

Status: ISSUE  
Risk: HIGH  
Service: Agent / RAG  
Relevant file/function: `agentcore/agent.py:system_prompt,run`; `tools/notes.py`, `tasks.py`, `knowledge.py`; `ragcore/qdrant_client.py:search`.

Current behavior: Retrieved document text and raw tool outputs are fed to the LLM, which has createNote/createTask available in the same loop. The system prompt requests retrieval but does not establish an enforced separation between untrusted document instructions and user-authorized actions. Registry lookup restricts execution to registered functions; this is a useful code-execution boundary, not an intent check.

Failure / risk: Malicious document instructions can induce task/note creation under the current user's valid token. This does not prove arbitrary code execution or an arbitrary HTTP destination: destinations are configured and tool scope comes from ContextVars. The concrete risk is unauthorized application actions within that user's accessible data, amplified by repeats and absent idempotency.

Smallest recommended fix: Mark retrieved text as untrusted data, validate tool inputs, and gate side-effect tools on explicit user-requested actions. For ambiguous model-derived writes, require confirmation of the concrete action. Test malicious retrieval that attempts to create notes/tasks; prompting alone is not a security control.

### Finding SEC3 — Dependency/release reproducibility needs a verified baseline

Status: PARTIAL  
Risk: MEDIUM  
Service: Build/deployment  
Relevant file/function: `backend/package.json`, `package-lock.json`; Python `pyproject.toml`, `uv.lock`, package `__init__.py` files; tracked `__pycache__` files.

Current behavior: Lockfiles exist. NestJS runtime/testing are v12 ranges while CLI/schematics are v11 ranges; mapped-types uses `*`, and Python manifests use lower bounds. The observed Jest ESM failure is concrete. Agent console script points to `agentcore:main` but that package initializer has no main function; RAG console script prints a greeting rather than serving FastAPI. ASGI applications do exist at `agentcore.main:app` and `ragcore.main:app`. Tracked Python bytecode is present. No deployment pipeline/container definition was found in the searched repository inventory.

Failure / risk: A fresh install/start path is not demonstrated; console scripts do not start the intended services. Ignoring lockfiles allows drift. No current CVE/outdated-package verdict can be inferred from version numbers alone; no registry vulnerability audit was run. These observations are not claims that the installed packages are vulnerable.

Smallest recommended fix: Document/test exact ASGI and Nest startup commands, lockfile-enforced installation, Prisma generation/migration steps and model preparation. Make the test toolchain compatible before claiming CI gates. Add a dependency audit in release verification; remove tracked bytecode as hygiene. Avoid package upgrades unrelated to demonstrated compatibility or advisory findings.

## 13. Concurrency

### Finding CON1 — Chat turns and Python work lack safe isolation and admission

Status: ISSUE  
Risk: HIGH  
Service: NestJS / Agent / RAG  
Relevant file/function: `ConversationMessagesService.create,findAll`; `agentcore/main.py:chat`; `ragcore/main.py:ingest,search`; `Agent.messages`.

Current behavior: Concurrent messages fetch the same preexisting history before either pair is written. USER timestamp is captured before Agent execution, ASSISTANT timestamp at insertion; ordering uses createdAt alone. No per-conversation sequence/claim exists. Tool calls are sequential inside each model response, not parallel. The Python async handlers perform synchronous requests/Ollama/PDF/embedding/Qdrant work; after entering that work they block the event loop of their worker.

Failure / risk: Concurrent turns can both reason from stale history, create overlapping effects, and interleave user/assistant ordering. Equal timestamps have no tie-breaker. Conversation deletion while Agent runs can cause final FK failure after effects have committed. On today's single event loop, shared Agent state is principally a failure-retention defect, not guaranteed simultaneous thread access; moving blocking code to threads without request-local state would introduce an additional race. Multiple workers remove neither DB nor vector races.

Smallest recommended fix: First make Agent state local; then run blocking work with bounded concurrency so health/admission stays responsive. Claim one active attempt per conversation or use a durable sequence/version conflict policy; persist pair identity and deterministic ordering. Reject/defer delete while an owned attempt is active or handle its cancellation/outcome explicitly. Do not hold database transactions open across LLM calls.

### Finding CON2 — Read-before-write checks and vector updates are not coordinated

Status: ISSUE  
Risk: HIGH  
Service: NestJS / PostgreSQL / RAG / Qdrant  
Relevant file/function: `MindspacesService.create,update`; `AuthService.register`; note/task update methods; `DocumentsService.upload,remove`; `QdClient.ensure_collection,upsert`.

Current behavior: MindSpace uniqueness is only a precheck; note/task updates are last-write-wins; ownership checks and mutation are separate queries. Parent deletion is protected relationally by foreign keys. Qdrant checks collection existence before creating it, creates an index during ingestion, and writes deterministic IDs in separate batches. Document deletion and ingestion can run concurrently.

Failure / risk: Duplicate MindSpace names can be inserted; email duplicates are prevented but may return 500; concurrent edits silently overwrite. Simultaneous collection bootstrap can conflict. Same-source concurrent ingestions can combine different content batches. Delete can remove file/row while in-flight ingestion writes vectors; later status update fails and cleanup still does not occur. A deleted parent can make a prechecked create fail after storage upload. No evidence supports a claim that ordinary ownership is transferable through update DTOs; the realistic race is disappearance/conflict, not arbitrary reassignment.

Smallest recommended fix: Add intended compound uniqueness and conflict mapping, optional optimistic edit versioning, a document generation/claim checked on completion, and coordinated deletion cleanup. Provision the vector collection/index once or handle concurrent creation idempotently. Use owner-qualified mutations where supported to reduce check/use gaps, while retaining clear 404 semantics.

## 14. Data Consistency and Partial Failures

### Finding D1 — Document upload has no compensation or publication boundary

Status: ISSUE  
Risk: HIGH  
Service: NestJS / Storage / PostgreSQL / RAG / Qdrant  
Relevant file/function: `DocumentsService.upload`; `RagService.ingest`; `ragcore/main.py:ingest`; `QdClient.upsert,search`.

Current behavior: Actual upload is validate signature -> verify ownership -> storage upload -> DB PROCESSING -> synchronous RAG download/parse/chunk/embed/upsert -> DB READY. Failure after DB creation attempts FAILED, with no cleanup/visibility change in Qdrant.

| Step fails or response is lost | Durable state left behind | Safe recovery currently implemented? |
|---|---|---|
| Validate/ownership | Normally no durable change; file may already be buffered | Rejection only; missing file can throw. |
| Storage upload | No DB row; storage may have committed before response loss | No object reconciliation. |
| Create Document row | Uploaded object without row | No compensation/delete. |
| Start/call RAG | File + PROCESSING; on exception FAILED if DB update works | No deadline/lease/retry action. |
| Download/parse/chunk/embed | File + row; no new vectors until upsert | Attempts FAILED except hung/crashed path. |
| Early Qdrant batches succeed, later fails | Partial vectors + FAILED/PROCESSING | Search does not exclude failed/uncommitted document vectors. |
| All writes succeed but RAG response lost | Complete vectors + FAILED or PROCESSING | No lookup of committed outcome. |
| RAG returns wrong 2xx JSON | Arbitrary JSON accepted, then READY | No committed-count/source/generation validation. |
| READY update fails | Vectors + FAILED or PROCESSING | No reconciliation. |
| Final upload HTTP response lost | READY document/file/vectors, client sees uncertainty | New upload creates duplicates. |

Failure / risk: Both orphan storage and orphan vectors are possible. READY without useful vectors is possible on an accepted empty/invalid result; FAILED with searchable vectors is directly supported by partial writes. Deterministic IDs do not make the entire workflow transactional.

Smallest recommended fix: Establish durable document/operation identity before external work, compensate storage when row creation fails (and record cleanup if compensation fails), and publish only a fully verified vector generation. Keep search visibility tied to a committed generation/document state; a payload boolean alone is insufficient unless both writes and search enforce it. Reconcile stale attempts and unknown outcomes before allowing replay. Existing DB records plus a small recovery task are sufficient; no distributed transaction is required.

### Finding D2 — Deletion does not delete knowledge or all stored objects

Status: ISSUE  
Risk: HIGH  
Service: NestJS / PostgreSQL / Storage / Qdrant  
Relevant file/function: `DocumentsService.remove`; `MindspacesService.remove`; Prisma cascade relations; `QdClient.search`.

Current behavior: Document delete removes storage then DB row; it never calls Qdrant. MindSpace delete cascades DB documents but calls neither storage nor Qdrant. Search filters only mindSpaceId, with no live document membership/status check. No vector deletion implementation was found.

Failure / risk: Deleted document text remains retrievable while its MindSpace exists. Deleting a MindSpace leaves file/vector orphans; normal owned NestJS access to that deleted MindSpace stops, but unauthenticated RAG can still query its old ID if reachable. Removing storage first can leave a live DB row pointing at a missing file after DB failure. Re-ingesting shorter text leaves old points retrievable as if current.

Smallest recommended fix: Persist a deleting/tombstone outcome, remove search visibility first, perform idempotent vector and storage cleanup, then finalize relational deletion. For MindSpace deletion, retain enough child storage/source metadata to complete cleanup instead of cascading it away first. Retry cleanup safely and block stale ingestion completion from republishing deleted content.

### Finding D3 — Tool commits can outlive failed conversations

Status: ISSUE  
Risk: HIGH  
Service: Agent / NestJS  
Relevant file/function: `Agent.run`; `createTask`, `createNote`; `ConversationMessagesService.create`.

Current behavior: LLM -> tool decision -> HTTP -> DB commit -> tool response -> LLM final -> message bulk insert. These are separate requests/transactions. No compensating deletion or operation ledger connects them.

Failure / risk: Lost tool response can look like failure after successful creation; a later loop or user retry duplicates it. LLM failure after a tool leaves an action with no chat record. Final message insert failure leaves all tools intact. Concurrent conversation deletion has the same result. Removing the action automatically is not necessarily safe because the user may already be using it.

Smallest recommended fix: Persist and replay tool outcomes by operation key, link them to the chat attempt, and expose partial completion honestly. Resume/reconcile instead of rolling back user-visible effects indiscriminately. Keep idempotent tools before enabling automatic mutation retries.

## Cross-Service Failure Maps

### Chat

```text
User request [missing/expired JWT, invalid body, duplicate request]
  -> NestJS [owner check; DB/history failure; unbounded history]
  -> Agent /chat [no service auth; shared residual history; no total deadline]
  -> LLM [unavailable/hung/empty response; malformed or repeated tool calls]
  -> Tool dispatcher [unknown name; wrong arguments; duplicate task schemas]
     -> NestJS notes/tasks [JWT + owner check; DB failure; COMMIT may succeed]
        -> response [lost/non-2xx treated as ordinary result; no deduplication]
     -> RAG search [body-selected scope; blocking embedding; bad/unbounded topK]
        -> Qdrant [60s per call; unavailable; stale/deleted/partial vectors]
  -> LLM [tool error mistaken for success; injection; later failure]
  -> Agent result [normal assistant OR last tool result after 10 steps]
  -> NestJS [weak content-only validation; response can be lost]
  -> PostgreSQL message pair [atomic local bulk write; can fail after tools]
  -> User [success, generic 500, indefinite wait, or ambiguous committed effects]
```

A plain answer skips tools. The sequence repeats LLM/tool steps up to ten iterations, with potentially multiple tool calls each iteration. Authentication on NestJS tools does not protect unauthenticated direct RAG retrieval or residual Agent memory.

### Document ingestion

```text
User multipart [JWT; UUID; missing file; unlimited buffering]
  -> NestJS [signature + owner check; no byte/page/time budget]
  -> Supabase Storage [upload failure OR committed object + lost response]
  -> PostgreSQL PROCESSING [failure leaves orphan object]
  -> RAG /v1/ingest [no service auth; no caller deadline; untyped body]
     -> Supabase download [SDK timeout; missing/unauthorized object]
     -> PDF extraction [invalid/encrypted/empty/large document]
     -> Chunking [whitespace infinite loop; unbounded count]
     -> Embedding [local CPU/GPU/memory; model failure; no total budget]
     -> Qdrant collection/index [unavailable/dimension mismatch/create race]
     -> Qdrant batches [partial commit; response loss; stale prior points]
  -> PostgreSQL READY [only HTTP/JSON checked; DB update may fail]
  -> User response [lost response can provoke a duplicate upload]

Caught ingestion/READY error -> attempt FAILED -> return 400
  [FAILED update may also fail; neither storage nor vectors are rolled back]
Crash/hang -> PROCESSING indefinitely [no recovery scan/lease]
```

## Critical Findings

1. **P1: Conversation-list ownership bypass.** Any authenticated caller with an owned MindSpace can omit the scope and receive other users' conversation metadata. Fix the final query and boundary validation before deployment.
2. **P2: Cross-user Agent history after failure.** A normal provider/tool exception leaves private content available to the next user's run. Make execution state request-local before deployment.

These are code-supported confidentiality failures. No CRITICAL rating is assigned solely because a cloud setting or infrastructure control was not inspected.

## High Priority Findings

- P3: Authenticate and restrict Python service ingress; bind RAG scope/source/storage to authorized context.
- F1: Fix whitespace chunk nontermination and prevent one PDF from blocking the RAG worker.
- D1/D2/S1: Recover document states, publish complete generations only, remove stale/deleted vectors, and reconcile storage/DB failures.
- S2/I1/D3: Persist chat/tool operation identity and recover partial success without duplicate writes.
- V2/V3/V4/F2: Bound and validate files/RAG requests/tool arguments/downstream results; fix duplicate createTask schema and MAX_STEPS final-result behavior.
- T1/CON1: Activate real deadlines and bounded execution; preserve request isolation when moving blocking work.
- R1/C1: Protect auth, chat, upload, search and ingestion with useful rate/concurrency/input budgets.
- O1/SEC1/SEC2: Remove sensitive logs and token literal; gate side-effect tools against instructions from untrusted documents.
- E1: Restore test execution and add the focused confidentiality/partial-failure regressions before release.

## Medium Priority Findings

- T2/SEC3: Make environment examples, route composition and startup commands reproducible.
- VER1: Pin model/chunk contracts and document a verified re-ingestion path before changing them.
- O2: Add bounded readiness and operational counters; full distributed tracing is optional.
- CON2: Enforce intended MindSpace name uniqueness and map database conflicts; use optimistic concurrency where lost edits matter.
- V1: Standardize UUID/nonblank/length validation and consistent safe API errors beyond the release-blocking scope bug.
- SEC1: Validate token settings, strengthen password policy, configure production CORS/TLS and verify Supabase exposure settings. Verification of actual private ingress/buckets is a deployment gate, not optional polish.
- SEC3: Run a current dependency audit and lockfile-enforced clean startup check; no CVE claim is made in this report.

## Low Priority / Nice to Have

- Remove unused imports, the duplicate global ValidationPipe, tracked bytecode, and placeholder users/weather behavior (disable invented weather before treating that tool as a real feature).
- Add richer tracing UI and dashboards after stable structured events/counters exist.
- Expand relevance tuning/eval datasets after a small representative retrieval and no-answer baseline passes. Search currently returns top matches without a score threshold; calibrate abstention from that baseline rather than inventing a universal cutoff.
- Add richer task transition policies only if product requirements introduce actual execution; `executor=AGENT` currently remains metadata.
- Add refresh sessions only if V1 needs them; do not build them solely for architectural completeness.

## Recommended Implementation Order

1. Close P1/P2 confidentiality defects with two-user regressions; preserve final-query ownership and request-local Agent memory.
2. Close direct Python trust boundaries and remove exposed credential/content logging. Verify actual private ingress, TLS, bucket policy and any Supabase Data API exposure.
3. Fix chunk nontermination; enforce document generation visibility, deletion cleanup and orphan recovery so failed/deleted data cannot remain valid knowledge.
4. Add minimal durable chat/document attempt state and idempotency for tool writes/messages/uploads. Reconcile lost responses and partial success before adding mutation retries.
5. Correct tool schemas, validate service responses and classify failures. Make MAX_STEPS an explicit unsuccessful completion, never a tool answer.
6. Activate per-call and end-to-end deadlines, propagate budgets/cancellation where feasible, and use bounded concurrency for blocking Python work.
7. Add input/history/tool/PDF/topK/storage quotas and endpoint-specific rate/concurrency limits; measure safe V1 capacities.
8. Add structured correlation/stage/outcome logs, readiness and stale-attempt/error/latency metrics without sensitive payloads.
9. Complete fault-injection, concurrency, contract and compact Agent/RAG eval gates. Tests for each earlier fix should accompany that fix; do not postpone security regression tests until this step.
10. Verify a clean locked install/start/migration/model preparation path and production configuration. Pin vector/model/chunk compatibility and document rollback/re-ingestion. Complete lower-risk cleanup afterward.

## Production Readiness Checklist

- [x] JWT signature and expiry checks plus current-user existence lookup exist.
- [x] Most CRUD paths derive identity from `req.user.userId` and check ownership.
- [x] DTO extra-field rejection, task enums, foreign keys and unique user email exist.
- [x] Qdrant collection dimension/cosine checks and deterministic same-source chunk IDs exist.
- [x] Qdrant calls have an explicit 60-second client timeout; Agent has a ten-iteration loop bound.
- [x] Current TypeScript source passes a non-emitting typecheck; all reviewed Python sources parse.
- [ ] Conversation list rejects missing/malformed scope and always filters final results by owner.
- [ ] A failed Agent request cannot leave messages for the next request/user.
- [ ] Agent/RAG ingress authenticates trusted callers and enforces authorized scope/document binding.
- [ ] Missing, oversized, corrupt, whitespace-only and empty/nonextractable documents fail safely.
- [ ] Chunk loop always advances; PDF/embedding work has memory/CPU/time/concurrency budgets.
- [ ] PROCESSING has an expiration/reconciliation path and owned retry on the same document identity.
- [ ] READY proves a complete committed vector generation; partial/FAILED/deleted generations are excluded from search.
- [ ] Document and MindSpace deletion clean up storage/vectors without losing recovery metadata.
- [ ] Shorter/concurrent re-ingestion removes stale points and cannot resurrect deleted content.
- [ ] Chat, upload, createNote and createTask have persisted idempotency outcomes and lost-response recovery.
- [ ] Tool schemas match callable signatures; unknown/invalid tools and HTTP failures have typed bounded results.
- [ ] Agent exhaustion/empty/malformed replies cannot be saved as successful assistant messages.
- [ ] Every external call has an explicit budget, and AGENT_TIMEOUT_MS actually aborts the request.
- [ ] Retry policy distinguishes reads, idempotent writes, transient failure and permanent/auth/validation failure.
- [ ] Concurrent messages have a defined sequence/active-attempt policy and atomic final pair storage.
- [ ] Login/register/chat/upload/search/ingest have rate and concurrency protection.
- [ ] History, text fields, tool calls/results, topK, PDF pages/chunks and per-user storage are bounded.
- [ ] Logs exclude JWT claims/tokens, PDF buffers/text, full history and retrieved content; the token literal is removed/revoked if needed.
- [ ] Correlation IDs and safe stage/duration/error/operation IDs connect NestJS, Agent, RAG and vector calls.
- [ ] Liveness and readiness are distinct; dependency and stale-attempt failures are observable.
- [ ] Critical unit/contract/integration/E2E regressions execute and pass, including failure and replay paths.
- [ ] Compact Agent/RAG evals cover tool correctness, no-answer retrieval, isolation and prompt injection.
- [ ] Environment examples/startup commands work from a clean locked installation; live migration state is verified.
- [ ] Deployment verifies private service ingress, TLS, storage policies, database backup/restore and dependency advisories.
- [ ] Model/chunk/payload versions are compatible and re-ingestion/cutover is tested before changing them.

## Final Assessment

**Already strong:** relational ownership checks on most endpoints, JWT expiry/user lookup, Argon2 password storage, DTO allowlists and enums, relational constraints, one-call message-pair insertion, deterministic chunk IDs, Qdrant dimension checks and batched vector writes provide a useful base.

**Partially production-ready:** CRUD can enforce ownership in ordinary flows; document statuses and vector metadata exist; the Agent has a finite iteration count. These are local controls. They do not yet guarantee confidentiality after failures, complete ingestion, correct deletion, bounded execution, or replay-safe effects.

**What prevents safe deployment:** conversation-list metadata disclosure and cross-user Agent history are immediate blockers. Unauthenticated Python trust boundaries, chunk nontermination, orphan/searchable failed or deleted document data, non-idempotent tool effects, missing deadlines/resource controls and absent passing critical tests prevent a credible fail-safe release.

**Before V1:** close confidentiality and trust-boundary defects; implement the smallest durable attempt/idempotency and document cleanup mechanisms; correct tool/response validation; bound execution/resources; remove sensitive logs; restore focused test gates; verify deployment configuration, migrations and dependency readiness. No large infrastructure rewrite is required, but an ownership-only happy-path demo is insufficient evidence.

**Safe to defer to V2:** full tracing infrastructure, large eval platforms, sophisticated retrieval ranking, generic workflow abstractions, richer task lifecycle enforcement, and refresh-session features if short-lived access-only sessions meet V1 requirements. Basic relevance/no-answer checks, compact failure tests and operational recovery cannot wait.

This assessment is grounded in the current source and the bounded checks listed above. It is not a live infrastructure audit or a claim that any recommended fix has already been applied.
