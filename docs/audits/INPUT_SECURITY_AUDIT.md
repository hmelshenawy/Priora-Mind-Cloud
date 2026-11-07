# Input Security and Sensitive Data Logging Audit

Date: 2026-11-07 (Asia/Dubai). Scope: current NestJS Backend, active Python Agent, RAG Service and Next.js Frontend. Application review was read-only; this report is the only created file. No actual credentials, user records, documents, embeddings or log contents were printed or reproduced. No services, live evaluations, attacks, commits or pushes were executed.

## Summary

**15 findings: 0 P0, 12 P1, 3 P2.** Existing protections are substantial but incomplete. The most immediate work is removing sensitive payload logging, containing tracing exposure, bounding uploaded/request bodies, and preventing untrusted model context from independently authorizing actions or external data transfers.

P0 denotes a demonstrated critical exposure requiring immediate containment; none was established. P1 denotes a material privacy, authorization or availability gap. P2 denotes validation consistency or defense-in-depth work. “Confirmed” below means source behavior or an isolated synthetic schema check, not proof of successful exploitation or deployed exposure. Conditional consequences and runtime questions are labeled explicitly.

This review supersedes older audit observations where code changed: UUID validation now works; history is typed and bounded; Nest forwards only the latest 48 messages; Agent and RAG routes now require internal service keys. Those protections must be retained.

## Existing protections verified

| Layer | Protection and evidence | Limits of the protection |
|---|---|---|
| Backend validation | Global `ValidationPipe` enables `whitelist`, `forbidNonWhitelisted` and transformation (`backend/src/main.ts:17-24`). | Plain `any`, route strings and manually forwarded internal objects do not acquire DTO validation automatically. |
| Backend body/rate limits | Default Nest Express JSON parser registration is present in installed `backend/node_modules/@nestjs/platform-express/adapters/express-adapter.js:232-240`; installed body-parser defaults to 102,400 bytes (`backend/node_modules/body-parser/lib/utils.js:62`). Global throttler config is 100 requests per 60,000 ms (`backend/src/app.module.ts:22-26,39-40`). | Not an unlimited JSON endpoint. These do not bound earlier Frontend buffering, multipart file bytes, total concurrent expensive work or model context size. Actual proxy limits and rate-limit behavior across replicas were not tested. |
| Backend identity | JWT strategy checks signature/expiry and user existence (`backend/src/auth/strategies/jwt.strategy.ts:18-35`). Auth uses Argon2 and returns selected user fields, not password hashes (`backend/src/auth/auth.service.ts:24-30,42-61`). | Authentication does not by itself establish ownership or user intent for an action. |
| Conversation authority | JWT-guarded controller passes server-derived user identity (`backend/src/conversations/conversations.controller.ts:11-32`); service checks ownership, derives MindSpace, scopes history and limits it to 48 recent messages (`conversation-messages.service.ts:14-42`). | Caller cannot forge history through the normal public chat DTO. History content still remains untrusted, and message lengths must agree across services. |
| Agent request validation | UUID MindSpace; message length 1–10,000 with whitespace rejection; at most 50 history entries, user/assistant roles only, each content 1–10,000 (`agent-service/src/agentcore/schemas.py:7-32`). Handler serializes typed history and UUID correctly (`main.py:40-44`). | No aggregate token budget, bearer-token length bound, or explicit rejection of extra fields. Role validation is not semantic injection protection. |
| Internal service authentication | `/chat` dependency (`agent-service/src/agentcore/main.py:39`); protected RAG ingest/search/embed (`rag-service/src/ragcore/main.py:32,67,81`). Verifiers use `secrets.compare_digest` and generic messages (`agent-service/src/agentcore/utils/service_verfication.py:20-30`; RAG equivalent `:25-33`). | Logs do not print the internal keys. Shared service identity is not a per-user/per-MindSpace authorization decision. |
| Tool registration/budgets | Fixed `tool(function)` list (`agent-service/src/agentcore/langchain_agent/tools.py:17-31`); tool limit 10 and model limit 6 (`langchain_agent/agent.py:41-53`). | No shell/delete tool is registered. Signature-derived argument validation and call counts do not enforce user intent, elapsed time or privacy of outgoing arguments. |
| Tool identity and ownership | CRUD tools obtain bearer token/MindSpace from ContextVars, not model parameters (`tools/tasks.py:33-42`, `tools/notes.py:24-32`). Nest verifies owned MindSpaces/resources (`backend/src/tasks/tasks.service.ts:10-54`, `notes/notes.service.ts:11-54`). | A permitted same-user write can still be unwanted. Background tasks inherit request context; do not infer cross-user leakage solely from the singleton Agent. |
| Memory/vector protection | Backend memory creates verify ownership; parameterized SQL searches include user and MindSpace (`backend/src/memory/memory.service.ts:22-35,117-130`; `event.service.ts:17-30,122-138`). DTOs constrain numeric embeddings to 1,024 entries and profile confidence to 0–1 (`memory/dto/create-memory.dto.ts:14-23`, both search DTOs `:3-8`). | No demonstrated SQL injection. Vector shape and similarity do not establish semantic trustworthiness of memories/documents. |
| Frontend rendering | `react-markdown` uses `skipHtml`, no raw-HTML plugin, and KaTeX `trust: false` (`frontend/components/message-content.tsx:25-30`). Installed Markdown default URL transformation rejects unsupported protocols (`frontend/node_modules/react-markdown/lib/index.js:124,320,421-444`). | Existing XSS cases are present in `frontend/tests/chat-markdown.spec.ts:179-197`, but were not run here. Safe HTML/protocol handling does not prevent legitimate HTTPS URLs from sending data externally. |
| Document handling | Normal upload checks PDF magic and MindSpace ownership (`backend/src/documents/documents.service.ts:19-39`); generated upload checks presence, MIME/magic and uses a server-derived user path (`documents.controller.ts:48-63`). PDF generator escapes markup and sanitizes filenames (`agent-service/src/agentcore/tools/pdf_generator.py:173-210`). | PDF magic is a format hint, not a parser resource bound. Generated upload is deliberately user-scoped; missing MindSpace there is not automatically an isolation defect. |

The HTTP runtime uses `agentcore.langchain_agent.agent.Agent` (`main.py:5`), not the older loops in `agentcore/agent.py` or workflows. Only active behavior is counted as an HTTP protection or exposure.

## Findings

### IS-01 — P1 — Active Agent logs expose prompts, history, memories and tool responses

**Evidence:** `agent-service/src/agentcore/langchain_agent/agent.py:77-83` prints content excerpts; `:100-104` logs tool result content at INFO; `:166` logs the complete constructed context; `:174-175` prints retrieved memory/event objects. `agent-service/src/agentcore/main.py:50` logs user skill metadata. `agent-service/src/agentcore/memory/memory.py:118-123,182,313-318` prints memory contents, response bodies, extraction messages and event summaries.

**Risk — confirmed sinks:** Private user messages, conversation history, personal memories, retrieved document passages and note/task responses can enter process logs. Tool results include generated-document download URLs, which are bearer capabilities; current signing lifetime is ten days (`backend/src/documents/storage.service.ts:50-53`). Excerpting to 500 characters does not make data non-sensitive, and a separate full-context log defeats that truncation.

**Minimal fix:** Remove payload prints/INFO logs; record request ID, operation/tool name, duration, result count and sanitized status/error code. Redact signed URL query strings and credential fields at logging boundaries as a backstop. Keep raw payload debug logging disabled in deployed builds; inspect every sink rather than only lowering a logger level, since `print` is independent of logging levels.

### IS-02 — P1 — RAG ingestion and embedding input text are logged

**Evidence:** Active `WordChunker` is selected in `rag-service/src/ragcore/main.py:16`; it prints each document chunk in `rag-service/src/ragcore/chunker.py:99`. `/v1/embed` prints its entire `texts` input (`rag-service/src/ragcore/main.py:83-85`). `storage.py:17` prints the first five downloaded bytes.

**Risk — confirmed sinks:** Ingestion can reproduce essentially the document's text across log lines. Embedding inputs may contain user questions, profile memories and event descriptions. These are sensitive even though they are being converted into vectors. The five-byte storage log is a separate limited fragment, not evidence of full-file logging.

**Minimal fix:** Delete raw chunk/text/file-byte output; retain document correlation ID, character/chunk count, model identifier, vector dimension and duration. Restrict access/retention for existing log stores through the normal operational process; do not copy historical sensitive logs into remediation tickets.

### IS-03 — P1 — Backend and Frontend duplicate response content into logs; upload objects are also logged

**Evidence:** `backend/src/conversations/conversation-messages.service.ts:66` prints every decoded response chunk; `frontend/app/api/chat-stream/[id]/route.ts:46` prints it again. `backend/src/documents/documents.controller.ts:25` prints the uploaded Multer object before service ownership validation. The object includes filename/metadata and an in-memory buffer. Node inspection may truncate the buffer, so this is not a claim that the whole PDF is printed. `conversation-messages.service.ts:53` separately logs the stream object.

**Risk — confirmed sinks:** Assistant replies can repeat private history, document excerpts, personal details or signed links, multiplying exposure across two server log stores. A failed or cross-scope upload can still log file metadata/bytes before the ownership failure. `JSON.stringify` escapes newlines but does not redact private data.

**Minimal fix:** Remove chunk and file-object logs. Use completion/error status, byte counts and an opaque correlation ID. Log upload outcome after authorization without original filename or buffer unless a documented diagnostic need requires sanitized metadata. The Frontend hit-only message at route line 8 is not itself sensitive.

### IS-04 — P1 — Tracing can export private inputs and outputs independently of process logs

**Evidence:** Trace decorators wrap chat and retrieval (`agent-service/src/agentcore/langchain_agent/agent.py:71,170`), extraction/retrieval (`memory/memory.py:49,147,178,341`); graph/model execution also participates in tracing. Local and Docker Agent configuration were checked only for tracing/hiding booleans: tracing is enabled and input/output hiding is not enabled in both files. No credential values were displayed.

**Risk — confirmed configuration, conditional export:** Prompts, history, retrieved content and tool results can be captured by the tracing SDK. Actual remote receipt, project permissions and retention were not inspected. Fixing console logs does not sanitize nested traces. Changing `.env.example` does not change running or actual environment settings.

**Minimal fix:** Disable content tracing until the intended data policy is set, or enable SDK-supported hiding/redaction for all relevant nested spans before export. Retain timings, tool names, policy outcomes and synthetic evaluation data. Verify remote access/retention and test trace payloads with synthetic canaries. Do not blindly redact names from legitimate assistant responses merely to solve a telemetry problem.

### IS-05 — P1 — Credential-shaped literal remains in Agent source

**Evidence:** `agent-service/src/agentcore/config.py:13` contains a JWT-shaped literal. Detection returned only file and line; the value was neither printed, decoded nor exercised.

**Risk — confirmed source artifact, validity unknown:** Source/distribution access can expose a credential-like value. No conclusion is made about current validity or whether this literal is used in the active flow; active tool calls obtain credentials from ContextVars. It is not evidence that the live bearer token is being directly logged.

**Minimal fix:** Remove the literal; privately assess whether it was a real credential and revoke it if still valid/exposed. Use existing environment/request credential handling. Add a secret-pattern check that reports filenames/locations without echoing matched secrets. Treat repository-history remediation as a separate controlled decision, not an automatic history rewrite.

### IS-06 — P1 — Missing body/upload bounds before expensive buffering

**Evidence:** Next chat proxy reads `request.text()` before downstream validation (`frontend/app/api/chat-stream/[id]/route.ts:10-20`). Both upload endpoints use `FileInterceptor("file")` without limits (`backend/src/documents/documents.controller.ts:21,49`); no global Multer limit was found. Installed Multer defaults to memory storage (`backend/node_modules/multer/index.js:17`), and Busboy's unspecified file-size limit is Infinity (`backend/node_modules/busboy/lib/types/multipart.js:254-256`). Agent/RAG app setup has no explicit raw-body cap (`agent-service/src/agentcore/main.py:16,39-44`; `rag-service/src/ragcore/main.py:14,32-38,81-87`).

**Risk — confirmed missing application bounds, runtime capacity untested:** Oversized requests can consume memory before later checks. An unauthenticated caller can reach Frontend buffering before Nest rejects missing credentials; authenticated users can submit oversized multipart files. Direct Python request parsing also precedes schema-level resource constraints. Nest's default JSON cap and throttling are real mitigations, not controls on these other paths. Proxy/platform limits may reduce exposure but were not verified.

**Minimal fix:** Set endpoint-appropriate byte limits at the earliest receiving boundary and enforce streaming byte counts for bodies without trustworthy length headers. In the Frontend reject absent authorization cheaply, while retaining Nest as the JWT authority. Configure Multer `fileSize`, field/part counts, and an explicit missing-file error before dereferencing `file.buffer`. Bound PDF pages/extracted characters and generated-PDF input size. Keep limits aligned with valid application payloads; don't apply one arbitrary cap to uploads and chat alike.

### IS-07 — P1 — RAG accepts untyped, unbounded request structures

**Evidence:** `rag-service/src/ragcore/main.py:32-58` directly indexes ingestion JSON; `:67-76` coerces `topK` with `int()` and embeds the supplied query; `:81-87` passes unrestricted `texts` to embedding. All three now require the service key.

**Risk — confirmed validation gap:** Missing keys/wrong shapes can become server errors, and large queries/batches/topK values can drive excessive extraction, inference and retrieval work. Service authentication restricts callers but does not prevent accidental or compromised-caller resource exhaustion. Search results return raw Qdrant payloads; that is not a schema contract or a trust assessment.

**Minimal fix:** Add small Pydantic request models for ingest/search/embed with UUID/source/storage-key shape, bounded text length, text-list length, positive capped topK, and consistent extra-field policy. Validate before storage/embedding work; bound extracted content and response projection. Do not strip instruction-like words out of documents: preserve their text as data while restricting how it can authorize actions.

### IS-08 — P2 — Validation contracts and aggregate limits are inconsistent

**Evidence:** `backend/src/conversations/dto/create-message.dto.ts:3-6` lacks max length and whitespace checks; notes/tasks text fields similarly lack length bounds (`notes/dto/create-note.dto.ts:7-13`, `tasks/dto/create-task.dto.ts:8-14`). Agent permits up to 50 × 10,000 characters of history (`agent-service/src/agentcore/schemas.py:7-15`), accepts empty `accessToken`, and uses the Pydantic default of ignoring extra fields. Conversation IDs are plain strings (`backend/src/conversations/conversations.controller.ts:21,44,64`); memory scope headers are unvalidated strings (`backend/src/memory/memory.controller.ts:22,34,45,56`).

**Risk — confirmed behavior:** Invalid requests pass one boundary and fail later; whitespace-only notes/tasks can become empty after trimming. Character/count limits are not an aggregate model-token budget. An assistant response over 10,000 characters is stored without an output cap (`conversation-messages.service.ts:58-83`) and can make the next chat fail history validation while it remains among the latest 48 entries. Empty token acceptance alone is not an auth bypass; Nest still rejects it on protected calls.

**Minimal fix:** Align DTO/Agent message bounds and whitespace semantics, validate UUIDs at controller boundaries, bound nonempty token strings without exposing them in errors, and define an aggregate history budget plus policy for large stored responses. Declare supported metadata before forbidding extras: Nest currently sends `sourceMessageId`, which Python ignores. Preserve code/quoted text rather than broadly normalizing content.

### IS-09 — P1 — Service authentication is not a user-to-MindSpace authorization check

**Evidence:** Agent trusts the request's token and MindSpace after checking the shared service key (`agent-service/src/agentcore/main.py:39-49`). Knowledge sends that MindSpace with the RAG service key (`tools/knowledge.py:19-29`). RAG accepts caller-selected scope/storage key (`rag-service/src/ragcore/main.py:35-41,70-76`); Qdrant filters by that scope only (`qdrant_client.py:150-165`).

**Risk — confirmed trust boundary, conditional abuse:** A trusted-service-key holder or buggy trusted caller can select an unrelated scope; Qdrant filtering isolates correctly only if that scope was authorized upstream. This is not an anonymous endpoint anymore and is not a demonstrated normal-user cross-tenant exploit. Normal chat derives owned scope at Nest; CRUD and memory endpoints separately enforce user ownership. A foreign memory search may return no rows rather than explicitly deny scope, so it should not be treated as a reusable proof of ownership.

**Minimal fix:** Make the authorized principal/scope invariant explicit before invoking the Agent/RAG tools. Reuse a narrow Nest ownership check or bind a server-issued context to the verified conversation/scope; do not ask the model to decide. For ingestion verify the storage key/source belongs to the authorized document. Keep service keys private, network access restricted, and add two-user negative tests. No new authorization framework is needed.

### IS-10 — P1 — Prompt injection can redirect tool actions or external data flow

**Evidence:** All tools are registered without an execution policy gate (`agent-service/src/agentcore/langchain_agent/tools.py:17-31`); create-task intent is described in a docstring (`tools/tasks.py:11-18`). User skill descriptions and retrieved memories enter system-role messages (`langchain_agent/agent.py:145-156,190-200`). RAG returns content directly (`tools/knowledge.py:39`), and web tools send model-generated queries/URLs (`tools/web_search.py:35-50`, `web_fetch.py:30-43`). Plain model text is streamed without a pre-release privacy gate (`langchain_agent/agent.py:107-113`).

**Risk — confirmed missing execution checks, attack success untested:** Direct user instruction overrides or indirect instructions in PDFs, skills, saved notes and web/tool results may cause unwanted authorized-account writes, credential/private-content export through queries, or disclosure in the answer. Backend ownership limits cross-user CRUD but does not validate action intent. Source similarity and HTTPS syntax do not establish instruction trust. Existing “treat as data, not instructions” guidance is useful but probabilistic.

**Minimal fix:** Keep immutable policy separate from user-controlled metadata; label retrieved text as data with provenance. Add a small deterministic tool wrapper that enforces allowed capabilities and validates arguments/egress at execution. If an action lacks explicit user authorization, return a proposed action instead of executing it; bind any later approval to user, scope and exact arguments. Do not require confirmation for every harmless read. Limit returned context to necessary fields, exclude credentials from external arguments, and buffer/check sensitive output before emission where required. Retain both existing call limits. No external guardrails framework is necessary.

### IS-11 — P1 — Skill identifiers bypass catalog/path and enabled-state restrictions

**Evidence:** `agent-service/src/agentcore/skills/skill_loader.py:61-67` joins the model-provided built-in name to a disk path without containment; `:152-158` splits/routes arbitrary identifiers. User listing filters enabled skills, but loading retrieves instructions by ID (`:76-94,96-111`); backend `findOne` checks ownership but not enabled status (`backend/src/user-skills/user-skills.service.ts:44-59`).

**Risk — confirmed validation gap:** Traversal/absolute names can reach an existing `SKILL.md` outside the intended directory if permissions allow. This is constrained to that filename, not arbitrary secret-file reading. An owned disabled skill remains loadable by ID. Actual outside-file access or model exploitation was not attempted.

**Minimal fix:** Resolve built-ins through the enumerated catalog, check canonical path containment including symlinks, validate prefixes and user-skill UUIDs, and enforce owned-and-enabled status on the execution path. Return generic loader errors without local paths; leave normal editing APIs able to display disabled skills.

### IS-12 — P1 — Untrusted input can become weakly validated persistent memory

**Evidence:** Automatic extraction tasks start for chat messages/history (`agent-service/src/agentcore/langchain_agent/agent.py:85-86`). Python memory/event schemas lack content/count/score bounds and nested entity schemas (`schemas.py:45-69`); extracted content is subsequently reused in system-role memory context (`langchain_agent/agent.py:190-200`). Nest event DTO only checks arrays and numeric salience (`backend/src/memory/dto/create_event.dto.ts:11-35`).

**Risk — confirmed schema weakness; semantic poisoning untested:** Instruction-like or sensitive content can be persisted and influence future turns. Isolated synthetic checks accepted empty memory content with confidence 8 and malformed event nested items/salience 8 in Python. Backend profile confidence is correctly restricted to 0–1, so that exact profile payload is not claimed to persist. Event salience/nested structures lack the equivalent defense. Existing extraction prompts, similarity thresholds and duplicate checks do not prove resistance to malicious retention instructions.

**Minimal fix:** Constrain nested shapes, lengths/counts and finite score ranges in existing Pydantic/Nest models. Reject credentials and behavioral override instructions from memory persistence using a focused retention policy; preserve ordinary useful personal facts. Retain source-message provenance and apply the same policy before future prompt assembly. Use synthetic malicious/benign paired tests; do not trust an LLM confidence score as authorization.

### IS-13 — P1 — Diagnostic document processing route lacks per-user authorization

**Evidence:** JWT-protected `POST /documents/test-queue` forwards no user identity (`backend/src/documents/documents.controller.ts:43-45`). `DocumentsService.testQueue` selects the first READY document globally and enqueues its storage key/scope (`documents.service.ts:105-131`). Processor updates document status and invokes RAG (`document.processor.ts:24-50`).

**Risk — confirmed code-level authorization defect:** Any authenticated caller can trigger processing of a potentially different user's document when such a READY row exists, causing resource use/status changes and potentially repeating content logging. No live enqueue was performed. The job's `forceFail` flag is not consumed by the processor; guaranteed forced failure is not asserted.

**Minimal fix:** Remove/disable the diagnostic route in deployed application builds. If retained, explicitly authorize the administrative operation, or require a specified owned document; never choose a global record for an ordinary user request.

### IS-14 — P2 — Safe Markdown still permits external resource requests

**Evidence:** `frontend/components/message-content.tsx:7-30` overrides selected tags but not Markdown images/links; installed `react-markdown` permits HTTP(S) URLs. Content is parsed during streaming. Session auth is stored in `sessionStorage` (`frontend/lib/auth-state.ts:11-24`). No application CSP declaration was found in the inspected Frontend configuration; proxy-set headers were not inspected.

**Risk — inferred data-egress path, not demonstrated XSS:** A model-produced Markdown image can cause the browser to request an external HTTPS resource, potentially carrying sensitive model-selected content in its URL. Links can do so on click. HTML/JavaScript sanitization already prevents important script vectors and should not be replaced. Session storage increases impact if another XSS exists, but this audit did not establish such an exploit or a token-reading path through Markdown.

**Minimal fix:** Disable automatic remote images in assistant content or allow only explicitly approved origins; present other images as opt-in links. Apply a restrictive image-source policy where appropriate and validate link destinations while preserving legitimate generated download links. Add a synthetic Markdown-image test that asserts no unapproved network request. Do not undertake an authentication rewrite solely because sessionStorage exists.

### IS-15 — P2 — Error/evaluation logging lacks a consistent safe-event contract

**Evidence:** Raw exception objects reach logs in `backend/src/documents/document.processor.ts:45`, `documents.service.ts:75`, `agent/agent.service.ts:58`; web-fetch errors stringify exceptions (`agent-service/src/agentcore/tools/web_fetch.py:51-53`). Evaluation prints include questions/retrieved text (`rag-service/src/ragcore/evals/runner.py:93-108`), judge output (`agent-service/src/agentcore/evals/langsmith_runner.py:128`), and old runner result objects (`evals/runner.py:68-74,118`). Legacy, non-HTTP Agent code also contains content/tool logs (`agent-service/src/agentcore/agent.py:77,195-197,258`).

**Risk — mixed certainty:** Evaluation/legacy content logging is confirmed if those paths run, but is not counted as active HTTP execution. Error-object exposure of credentials, URLs or payload fragments depends on library exception contents; no actual secret-bearing exception was observed. Free-form raw content can also forge log structure. Current generic service-auth success/failure logs are safe examples and should remain.

**Minimal fix:** Standardize allowlisted structured events with request ID, component, operation, stable error/policy code, status and duration. Scrub credential headers, signed URLs, request bodies and CR/LF in logged fields. Use synthetic data for evaluations and make content-rich debugging an explicit isolated opt-in. Record validation/authorization failures and tool denials without recording the rejected sensitive payload. Preserve existing Evaluation V1 and add focused negative tests rather than replacing it.

## Sensitive-data exposure inventory

| Data type | What the inspected code establishes |
|---|---|
| Access tokens and internal/API secrets | Used in request bodies/headers/ContextVars; no explicit active `print(token)` or authorization-header dump was identified. A credential-shaped source literal exists (IS-05). Content logs can leak a secret if a user/document/tool includes one, and generic exception/trace behavior remains a secondary risk. Do not claim routine live-token logging without runtime evidence. |
| User messages and conversation history | Full constructed Agent context and event extraction messages enter logs (IS-01); trace input capture is enabled in local/Docker settings (IS-04). |
| RAG documents | Active chunker prints document chunks; Agent tool-result logs can repeat retrieved text (IS-01/02). Backend upload logging exposes metadata and potentially a buffer excerpt (IS-03). |
| Embeddings | Raw input text is logged before embedding. No explicit active numeric-vector log was found. Backend vector queries return selected fields without embeddings (`memory.service.ts:92-100,117-130`); RAG search requests payloads but does not explicitly request vectors (`qdrant_client.py:150-165`). Proxy/APM/exception capture of embedding HTTP bodies was not inspected. Avoid logging vectors as well as their source text. |
| Tool responses | Agent logs raw result content, including notes/tasks, RAG payloads and signed download URLs. Tool messages are skipped on the wire, but model paraphrases can still appear in replies and reply logs. |
| Frontend auth data | Browser session storage holds login state; this is not logging. The Next server proxy forwards authorization to the fixed configured Backend origin without printing it. Its chunk logger exposes output content, not necessarily the access token. |

## Minimal remediation order

1. Remove active content/file/chunk logs; constrain trace exports; privately assess/remove the source credential literal (IS-01–05).
2. Bound Frontend/Python bodies and multipart/extraction work, type RAG requests, and disable the diagnostic enqueue path (IS-06, IS-07, IS-13).
3. Enforce scope and tool-intent boundaries; constrain skill loading and retained memories (IS-09–12).
4. Align DTO/history budgets, prevent unapproved remote images, and add safe event/error/evaluation handling (IS-08, IS-14–15).

Reuse Nest validators/guards, FastAPI/Pydantic, current logging libraries and a small tool wrapper. Do not add a moderation service, replacement agent framework or blanket keyword filter. These recommendations follow [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) on excluding sensitive payloads and [OWASP prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) on enforcing tool permissions outside the model; repository evidence determines the findings above.

## Verification performed and remaining checks

Performed source inspection, targeted installed-library inspection, and isolated schema checks via the existing Python virtualenv with `-B` (no bytecode writes). Only synthetic inputs were used. Valid UUID accepted; system-role history rejected; 51 history entries rejected; 10,001-character message rejected. Empty access token, unknown metadata, whitespace-only history, and the maximum 500,000-character history payload were accepted. Weak Python memory/event examples described in IS-12 were also accepted. These tests validate the schema only, not an end-to-end deployment.

Recommended regression checks after remediation:

- Capture process logs and nested trace exports with synthetic secret/document/message canaries; assert absence from normal success, denial, error and cancellation paths.
- Exercise byte limits with and without Content-Length, oversized multipart uploads, invalid PDFs, excessive embed batches/topK and malformed nested data; assert controlled errors before expensive work.
- Use two isolated users/MindSpaces for CRUD, RAG scope, disabled skills and diagnostic routes; assert no unauthorized operation occurs.
- Test prompt injections through user text, PDF chunks, memory, skill descriptions and tool results; measure actual executed side effects/egress, not merely refusal wording. Include benign quoted instructions and EN/AR cases to catch false positives.
- Test split-token secrets and unapproved Markdown image URLs on the actual stream; verify both emitted bytes and network requests. Preserve existing raw-HTML/unsafe-protocol tests.
- Verify large assistant output cannot poison the next request's history contract; retain current model/tool limits and test deadline/cancellation behavior separately.

Not verified: deployed ingress limits, log collector access/retention, live service-secret validity, LangSmith receipt/permissions, proxy CSP, attack success rate, or storage/network policy. No P0 claim rests on these unknowns. Git was clean at audit start; final scope verification must show only this report as new. Application code, actual environment files, examples and prior reports were not changed.
