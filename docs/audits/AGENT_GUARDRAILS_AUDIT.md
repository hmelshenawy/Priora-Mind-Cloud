# Priora MindCloud — Agent Guardrails Audit & Implementation Plan

Audit date: 2026-11-07 (Asia/Dubai). Scope: current working tree; read-only application review, with this report as the only authored artifact.

## 1. Executive Summary

**Maturity: foundational controls exist, but enforcement is incomplete across service boundaries, streaming, and secondary memory work.** This is not an unguarded agent: it has typed tool wrappers, two LangChain execution limits, backend JWT verification and ownership checks, structured memory extraction, scoped vector queries, and Evaluation V1. Retain those controls. Prompt instructions supplement them but do not establish authorization or prove injection resistance.

**Finding totals: 0 P0, 11 P1, 4 P2 (15 findings).** P1 means a material security, privacy, or availability gap to address next; P2 means bounded hardening or quality work. These are finding counts, not counts of proven exploits. No critical/P0 issue is established by this audit. If runtime verification establishes unauthenticated access to other users' RAG data from an untrusted network, escalate F02 to P0 and resolve it before lower-priority work.

Highest-priority risks:

1. **F02: unauthenticated internal Agent/RAG contracts** depend on deployment isolation; RAG trusts a caller-selected MindSpace. Production Compose reduces exposure but the Agent joins a shared external network, and development publishes both service ports.
2. **F01: current input validation breaks ordinary chat** by limiting MindSpace IDs to 32 characters while Prisma creates UUIDs. A synthetic 36-character UUID was rejected locally. This is in pre-existing uncommitted code, not necessarily deployed code.
3. **F05: prompt-controlled tools have no application-enforced action/egress policy.** Backend ownership prevents many cross-user writes, but does not prevent an injected instruction from causing an unwanted write within the authorized user's account or sending private content to a web provider.

**First implementation ticket: GR-IN-01**, a small contract correction with a focused regression test. Start GR-IN-02 immediately afterward; do not expose these Python services to untrusted callers while that boundary remains unverified. F07 privacy containment and F15 diagnostic-route restriction are also early work, not end-of-roadmap cleanup.

Verification performed: source and dependency inspection; installed-package metadata inspection; isolated Pydantic checks using the existing virtualenv with Python `-B` (no bytecode writes); comparison of the existing schema diff. No application startup, live API calls, database operations, evaluation execution, dependency installation, commits, or application edits were performed. Live evaluation would invoke real tools and publish LangSmith data, so it was intentionally not run.

At audit start Git already showed modifications to `agent-service/src/agentcore/schemas.py` and its tracked `__pycache__/schemas.cpython-312.pyc`. Both are outside this report's modifications. Source citations below refer to the inspected working tree and may move in subsequent edits. No credential values are reproduced.

## 2. Current Agent Architecture and Trust Boundaries

### Active request path

1. `ConversationsController.createMessage` is JWT guarded and passes `req.user.userId` and the bearer header to `ConversationMessagesService.create` (`backend/src/conversations/conversations.controller.ts:11-39`).
2. The service verifies conversation ownership through `mindSpace: { userId }`, derives MindSpace from the conversation, and builds history from stored messages. It does not accept client-supplied roles or MindSpace for this route (`backend/src/conversations/conversation-messages.service.ts:14-39,79-90`).
3. `AgentService.runAgent` forwards message, history, access token, MindSpace, and `sourceMessageId` to Python using an abort timeout. Non-success HTTP responses become generic errors (`backend/src/agent/agent.service.ts:12-55`). The source message ID is currently an empty string at the call site and Python does not declare it.
4. FastAPI `/chat` validates `ChatRequest` and returns a plain-text streaming response. The generator sets credential and MindSpace ContextVars, lists skills, then streams the singleton agent (`agent-service/src/agentcore/main.py:38-61`). No FastAPI authentication dependency is installed.
5. The **active** implementation is `agentcore.langchain_agent.agent.Agent`, explicitly imported in `main.py:5`. The older `agentcore/agent.py` Agent and workflow implementations are not the HTTP runtime. Their separate loops/error handlers must not be credited as active defenses.
6. Before graph execution, `Agent.stream` retrieves profile/event memories and builds messages containing skill metadata, supplied history, retrieved memories, and the current message. It starts two detached extraction tasks, then consumes `astream(stream_mode="messages")` (`langchain_agent/agent.py:71-113`).
7. Backend tools use ContextVars to supply bearer authorization and MindSpace; these values are not model arguments. Knowledge search directly calls RAG with a ContextVar MindSpace but no authentication (`tools/knowledge.py:19-36`). Web search/fetch use Ollama's cloud web APIs, verified in installed `ollama/_client.py:793-832`; this is not a local arbitrary-URL HTTP fetch implementation.
8. Python streams model-node text, skips tool messages, and does not wait for complete-answer validation. NestJS forwards each chunk and persists the user/assistant pair only after the upstream stream ends (`conversation-messages.service.ts:43-74`).

### Boundary map

| Boundary | Established authority | Residual trust |
|---|---|---|
| Browser → NestJS | JWT signature/expiry and user lookup; global DTO whitelist | Message content remains untrusted; no explicit chat length cap in Nest DTO |
| NestJS → Agent | Nest derives conversation ownership and history | Python cannot authenticate that the sender is Nest; token and MindSpace are body fields |
| Agent → CRUD/memory | Nest JWT and ownership/query predicates | Authorized model actions are not necessarily intended user actions |
| Agent → RAG → Qdrant | Query has an exact MindSpace filter | Caller controls filter value; RAG has no principal verification |
| Documents → RAG ingestion | Normal Nest upload checks MindSpace ownership | Direct RAG ingestion and diagnostic queue route bypass parts of that provenance |
| Skills/memories/documents → prompt | Some explicit “data, not instructions” guidance | User descriptions and memory strings enter system-role messages; content is not trusted policy |
| Agent → web provider | Fixed provider endpoints and HTTPS URL syntax | Search terms/URLs can contain private data; remote URL safety is not established |
| Agent → logs/LangSmith | Trace decorators and debug output | User content, tool data, and signed links may leave their intended audience |

The production Compose file does not publish Agent or RAG ports; Agent also joins `n8n_default` (`docker-compose-prod.yml:21-38,87-89`). Development maps `8000:8000` and `8800:8800` (`docker-compose-dev.yml:14-30`). These are repository configurations, not proof of the running firewall/proxy/network state.

The singleton graph is not itself evidence of shared tenant state: each invocation receives its own message state and ContextVars are task-local. No graph checkpointer is supplied. Concurrent-call isolation still needs tests, especially for threads, extraction tasks, exceptions, and cancellation.

### Middleware behavior and ordering

`create_agent` configures, in order, `ToolCallLimitMiddleware(run_limit=10)` and `ModelCallLimitMiddleware(run_limit=6, exit_behavior="end")` (`langchain_agent/agent.py:41-54`). Installed factory code connects before-model hooks in registration order and after-model hooks in reverse order (`agent-service/.venv/Lib/site-packages/langchain/agents/factory.py:1834-1869`). Consequently, the model limit checks before inference; after inference its counter updates before the tool limiter processes proposed calls.

Installed tool-limit code defaults to `exit_behavior="continue"`, returns errors for excess proposed calls, and tracks calls in run state (`.../middleware/tool_call_limit.py:202-255,327-495`). Model-limit code stops before a seventh graph model invocation and produces a terminal AI message (`.../middleware/model_call_limit.py:186-208,235-267`). These limits are implemented, not hypothetical. They are neither wall-clock deadlines nor limits on the independent extraction/salience model calls. The HTTP adapter's model-node-only filter may omit middleware-generated terminal explanations; test this exact stream path rather than assuming graph state equals client-visible output.

## 3. Existing Guardrails Inventory

| Mechanism and execution point | Evidence | Mitigation and limit |
|---|---|---|
| Pydantic chat validation before handler | `agent-service/src/agentcore/schemas.py:7-28` | Rejects missing/wrong message types, empty/whitespace content and messages over 10,000 characters; trims outer whitespace. UUID cap is wrong; history is untyped. |
| Nest global validation | `backend/src/main.ts:17-24` | Whitelist, reject unknown DTO fields, transform; does not validate plain TypeScript types at internal service calls. |
| JWT signature, expiry, existing user | `backend/src/auth/strategies/jwt.strategy.ts:14-36` | Establishes backend principal. No equivalent Python check. |
| Conversation ownership/server history | `conversation-messages.service.ts:14-39,79-90` | Blocks normal cross-user chat/history access. Full stored history is unbounded. |
| Notes/tasks ownership | `backend/src/notes/notes.service.ts:11-54`; `backend/src/tasks/tasks.service.ts:10-54`; both controllers `:20` | Authenticated CRUD/list access is scoped. Task controller also parses UUID route/query values; do not infer identical parsing everywhere. |
| Basic duplicate-write suppression | `tasks.service.ts:77-87`; `notes.service.ts:75-88` | Two-minute matching window, not atomic idempotency under concurrency. |
| Typed LangChain tools and fixed registration | `langchain_agent/tools.py:17-31`; `langchain_agent/agent.py:23-29` | Function signatures become argument schemas; no shell/SQL/delete tool is registered. Legacy handwritten schemas are not the active schemas. |
| Tool/model limits | `langchain_agent/agent.py:45-53` | Ten graph tool calls and six graph model calls per run; preserve both. |
| Credential context separated from model arguments | `context.py:1-4`; `tools/tasks.py:33-42`; `tools/notes.py:24-32` | Model cannot select JWT or MindSpace through these tool arguments. Caller authentication still matters. |
| Context cleanup | `main.py:47-56` | Reset in `finally` once the try is entered; preliminary skill logging occurs before it. |
| Backend memory validation/isolation | `backend/src/memory/memory.controller.ts:10-59`; `memory.service.ts:22-35,107-131`; `event.service.ts:17-30,110-139` | JWT, create ownership, parameterized SQL with both user and MindSpace filters, duplicate checks. Search returning no rows for a foreign scope is not a cross-tenant leak. |
| Embedding and confidence checks | `backend/src/memory/dto/create-memory.dto.ts:7-23`; `create_event.dto.ts:28-35`; both search DTOs `:3-8` | 1,024 numeric dimensions; profile confidence 0–1. Event nested data and salience range are incomplete. |
| Structured extraction | `langchain_agent/llm.py:16-24`; `schemas.py:40-65`; `memory/memory.py:170-204` | Pydantic parsing, event vector dimension check and score-count match; semantic truth/consent is not validated. |
| Retrieval thresholds | `memory.service.ts:112-130`; `event.service.ts:114-138`; `memory/memory.py:311-318` | Profile 0.6/top 5; event backend 0.4/top 10 and agent post-filter 0.5; duplicate thresholds 0.8. Preserve and calibrate, do not reinvent. |
| Qdrant scoping/vector validation | `rag-service/src/ragcore/qdrant_client.py:46-105,123-146,150-165` | MindSpace filter, dimensions/cosine collection checks, basic chunk fields. Scope is not authenticated and no search relevance threshold is set. |
| Skill ownership/metadata limits | `backend/src/user-skills/user-skills.service.ts:33-59`; `dto/create-user-skill.dto.ts:5-23` | User-scoped retrieval, 100/500/5,000 character fields; enabled-only listing. Exact loading does not require enabled status. |
| Existing prompt guidance | `prompts/prompts.py:16-66,91-97,164-177`; `langchain_agent/agent.py:140-152,190-200` | Relevance, no fabrication, source links, untrusted skills/memory and current-message event extraction. Probabilistic guidance only. |
| Bounded web results | `tools/web_search.py:35-50`; `tools/web_fetch.py:30-43` | 1–10 results, 1,200 chars/result; HTTPS syntax and 6,000-char fetched content cap. No local private-host/egress policy. |
| Several network timeouts | `tools/tools.py:25-29`; `tools/notes.py:24-32`; `tools/tasks.py:33-42`; `tools/knowledge.py:19-26`; `tools/pdf_generator.py:275-290` | Existing finite HTTP timeouts must be retained. Memory and model paths have gaps. |
| PDF safeguards | `tools/pdf_generator.py:46-68,173-210,265-291`; `backend/src/documents/documents.controller.ts:48-68` | In-memory rendering, escaping, HTTP(S) links, safe filename, backend PDF magic/MIME and user-derived storage prefix. No arbitrary output filesystem path. |
| Evaluation V1 and tracing | `evals/langsmith_runner.py:42-46,49-290,294-355,418-448`; `langchain_agent/agent.py:71,170` | Tool-set match, correctness, faithfulness, groundedness and retrieval traces exist. Coverage excludes important production paths. |

Active tools are `getDateTime`, `getWeather`, `getDirections`, `getFlightSearchLink`, `getHotelSearchLink`, `searchActivities`, `searchKnowledge`, `generate_pdf`, `webFetch`, `webSearch`, `createTask`, `getAllTasks`, `createNote`, `getAllNotes`, plus `load_skill`. Travel functions mostly generate encoded links rather than book trips. `AGENT` task executor is stored metadata in the inspected CRUD path; no task execution worker is established here.

## 4. Findings and Risk Assessment

Evidence labels: **Confirmed** = observed code behavior or isolated reproduction; **Inferred risk** = credible consequence not exercised; **Runtime verification** = deployment/provider/model behavior still unknown. Multiple labels can apply to one finding.

| ID | Priority | Finding and evidence | Assessment |
|---|---|---|---|
| F01 | P1 | `ChatRequest.mindSpaceId` max length 32, versus UUID defaults in `backend/prisma/schema.prisma:50-51` and unchanged forwarding in `agent.service.ts:18-30`. | **Confirmed locally:** a standard UUID is rejected with `string_too_long`. Normal current-tree chat contract is broken. Deployed version unknown; change exists in pre-existing local diff. |
| F02 | P1 | `/chat` has no authenticated dependency (`main.py:38-61`); RAG ingest/search/embed parse raw JSON without auth (`ragcore/main.py:23-79`); knowledge sends selected scope without auth (`tools/knowledge.py:19-26`). | **Confirmed missing service checks.** Direct RAG callers can select a scope in code. **Runtime verification:** reachable networks, actual data and access. A no-token `/chat` exploit is not demonstrated: pre-graph memory and skill calls can fail at Nest first. A stolen/valid token does not make arbitrary supplied scope authoritative. |
| F03 | P1 | `history: list`, unbounded token string, permissive extra-field default (`schemas.py:7-11`); direct `*history` insertion (`langchain_agent/agent.py:132-157`); Nest loads all history (`conversation-messages.service.ts:87-90`); Nest message DTO has no length/whitespace rule. | **Confirmed:** system-role history and `[42]` pass schema validation; unknown `sourceMessageId` is silently dropped. **Inferred:** direct-caller role injection, runtime exceptions, oversized context/compute pressure. Normal Nest path supplies server-owned history, which mitigates client role forgery there. |
| F04 | P1 | `BuildinSkillProvider.load_skill` joins unconstrained name to disk and reads `SKILL.md` (`skills/skill_loader.py:61-67`); identifier split not validated (`:152-158`); user loader retrieves any owned skill (`:96-111`; `user-skills.service.ts:44-59`). | **Confirmed:** no path containment/catalog allowlist and no enabled-state check on execution. Traversal is restricted to an existing file ending in `SKILL.md`, not unrestricted secret-file reading. **Runtime verification:** reachable outside files and model exploitation. Disabled owned skills can still be loaded by ID. |
| F05 | P1 | All registered tools are always available (`langchain_agent/tools.py:17-31`); write intent is a docstring (`tools/tasks.py:11-18`), not an enforcement gate. User skill descriptions are in a system message (`langchain_agent/agent.py:145-154`). Web search/fetch receive model-generated strings. | **Confirmed control gap; inferred attack success:** untrusted skills, RAG or memory can redirect authorized writes or cause private data to be embedded in external queries/URLs. Existing ownership is effective against different-user CRUD access, not against same-user unwanted operations. No destructive delete or shell tool was found. |
| F06 | P1 | Memory embed/save/search omit timeouts (`memory/memory.py:74,98,118-121,248,294-297`); `ChatOllama` has no explicit deadline (`langchain_agent/llm.py:6-11`); detached tasks (`agent.py:85-86`); synchronous skill listing on async path and before `try` (`main.py:47-51`). | **Confirmed reliability gaps:** graph call limits do not bound these calls. Skill failures before `try` bypass explicit resets; that is not proof of cross-request leakage. Detached tasks inherit context and may outlive disconnect; no registry or explicit outcome handling. Nest abort is useful but not complete cancellation propagation. |
| F07 | P1 | Full prompt/memories/tool content logged (`langchain_agent/agent.py:77-83,100-104,166,174-175`); memory request/response prints (`memory/memory.py:100-105,164,282`); RAG embeds print text (`ragcore/main.py:74`); Nest prints chunks (`conversation-messages.service.ts:54`); credential-shaped literal in `agent-service/src/agentcore/config.py:12`. | **Confirmed sensitive-data handling defects.** Literal validity/use is not established; active tools use ContextVars instead. No value reproduced or tested. Traces capture content by design, but actual LangSmith enablement, access, retention and export destination require verification. Signed URLs in results are bearer capabilities. |
| F08 | P1 | Direct model chunks emitted before validation (`langchain_agent/agent.py:100-113`); Nest concatenates/forwards and persists on ordinary stream end (`conversation-messages.service.ts:46-74`); controller lacks explicit disconnect/backpressure handling (`conversations.controller.ts:35-39`). | **Confirmed missing output/completion enforcement.** Potential secret leakage, partial/empty answers, fabricated success, and unsignaled budget exhaustion. Tool messages are correctly excluded from wire output, but model paraphrases of tool data are not. Tokens already delivered cannot be recalled by an after-model check. |
| F09 | P1 | Memory content/scores/nested objects insufficiently constrained (`schemas.py:40-65`), unconditional background extraction (`agent.py:85-86`), no credential/instruction retention policy, source ID absent (`conversation-messages.service.ts:25`; `schemas.py:7-11`). | **Confirmed:** empty profile content/confidence 8 and event nested integers/salience 8 pass Python schemas. Backend rejects profile confidence outside 0–1, so do not claim that exact profile payload persists. Event DTO lacks equivalent range/nested checks. **Inferred:** persistent prompt poisoning, retention of credentials, incorrect events and weak provenance. |
| F10 | P1 | `DocumentsService.remove` deletes storage and SQL metadata only (`backend/src/documents/documents.service.ts:92-103`); Qdrant search filters only MindSpace (`qdrant_client.py:150-165`). | **Confirmed missing deletion propagation:** no vector deletion/tombstone step in this path. **Inferred impact:** previously ingested deleted content remains retrievable until separately removed. Live stale results not queried; external cleanup unknown. |
| F11 | P2 | RAG search has unbounded raw `topK`, no response schema or score cutoff (`ragcore/main.py:57-67`); Qdrant forwards payloads (`qdrant_client.py:150-167`); agent returns raw JSON (`tools/knowledge.py:36`). | **Confirmed grounding gap:** low-relevance chunks and payload metadata can become context; source IDs exist but final citations are not checked. `active`/`approved` are set true at ingestion (`qdrant_client.py:136-143`), not an actual review mechanism. Injection/false attribution rates need measurement. |
| F12 | P2 | Nine quality/tool cases (`evals/dataset.json:2-79`); set-based comparison drops multiplicity/order (`langsmith_runner.py:42-46`); runner invokes graph directly (`:317-325`), skips HTTP/stream/memory extraction; `expected_rag_empty` has no evaluator. | **Confirmed coverage gaps**, not failure of Evaluation V1. Mock helper explicitly unused (`evals/mock_tools.py:3`); evaluation can execute real tools and upload datasets/traces. Older `runner.py:2-3` imports `report` and Python `dataset` modules absent from the inspected directory. Actual LangSmith outcomes not inspected. |
| F13 | P2 | Active schemas come from function signatures (`langchain_agent/tools.py:17-31`); `createTask` accepts executor as unrestricted `str` (`tools/tasks.py:9`), despite enum in unused legacy schema (`:76-79`); list outputs and PDF content are unbounded. | **Confirmed partial argument/resource guardrails:** Nest still rejects invalid task enums. Invalid hotel dates raise before a normalized result (`google_travel_api.py:115-122`). Installed ToolNode handles invocation validation errors, but default handler rethrows other tool exceptions (`.venv/Lib/site-packages/langgraph/prebuilt/tool_node.py:391-407`). |
| F14 | P2 | Generated PDFs use user-scoped random storage paths and signed URLs (`documents.controller.ts:48-68`); URL lifetime is ten days (`storage.service.ts:50-61`). | **Confirmed capability lifetime; policy risk:** shared/download URLs remain useful beyond a chat session. No expiry/retention policy or cleanup is demonstrated. This is not evidence of a public bucket or cross-user upload. Whether generated PDFs should belong to a MindSpace remains a product question. |
| F15 | P1 | JWT-protected `POST /documents/test-queue` passes no identity (`documents.controller.ts:43-45`); `DocumentsService.testQueue` picks first READY document without owner scope and enqueues it (`documents.service.ts:105-131`); processor changes status and invokes ingestion (`document.processor.ts:24-50`). | **Confirmed authorization defect in supporting RAG boundary:** any authenticated caller can trigger processing of another user's selected document, conditional on a READY row existing. `forceFail` is put in job data but ignored by the processor, so do not describe guaranteed forced failure. No data disclosure or live exploitation demonstrated. |

### Important non-findings and limits

- No confirmed SQL injection: inspected memory queries use Prisma parameterized tagged templates.
- No confirmed local-network SSRF through `webFetch`: installed Ollama delegates to its cloud web-fetch endpoint. Local checks allow private-looking HTTPS hosts, but provider rejection/redirect behavior is unverified. Restrict egress for privacy and policy; do not label an untested provider behavior a critical SSRF exploit.
- No evidence that tool signatures expose JWT, user ID or MindSpace selection to the model for CRUD tools.
- `run()` and evaluation graph invocation omit stream-path memory retrieval and extraction, but still use the same configured graph limits. Legacy loops are a maintenance concern, not an observed active HTTP bypass.
- The system prompt builder interpolates the `SYSTEM_PROMPT` dictionary rather than its content (`prompts/prompts.py:70-78`). Guidance is present as stringified data; simplify this when improving prompt boundaries, but this alone is not an authorization vulnerability. The date is built at singleton construction and can become stale.

## 5. Recommended Guardrails and Technology Choices

### Compatibility evidence

Installed metadata reports **LangChain 1.4.7, langchain-core 1.7.3, langchain-ollama 1.1.0, LangGraph 1.2.18, LangSmith 0.14.16, Pydantic 2.13.5, FastAPI 0.141.1, Ollama 0.6.2**. Lock entries agree for the versions checked (`agent-service/uv.lock:230-231,450-451,511-512,570-571,616-617,822-823`). Package minimum constraints in `pyproject.toml` alone are not treated as installed versions. Docker uses `uv sync --frozen` (`agent-service/dockerfile:9`); the actual deployed image was not inspected.

The installed middleware exports and source support current tool/model limit constructor arguments and custom `wrap_tool_call`/`awrap_tool_call` hooks (`.../middleware/types.py:674-805`). Keep asynchronous hooks for this async graph. Do not assume a custom sync-only wrapper also covers async execution.

Installed `PIIMiddleware` has input/output/tool-result controls and output stream transformers (`.../middleware/pii.py:581-678`). Its documented transformer coverage specifically mentions v3 event/run surfaces, while Priora consumes legacy `astream(stream_mode="messages")`. **Compatibility of redaction on this exact wire path is unverified**; require split-token leakage tests or use an explicit output buffer/gate. Neither “PII middleware cannot stream” nor “adding it guarantees safe streaming” is justified. Current official [LangChain middleware reference](https://reference.langchain.com/python/langchain/agents/middleware) corroborates available components; installed source governs this plan.

| Gap | Preferred mechanism | Decision |
|---|---|---|
| Types, lengths, nested memory shapes | Existing Pydantic + Nest DTO validators | Small explicit contracts; preserve meaningful content rather than deleting suspicious words. Reject whitespace-only input using a trimmed check without silently rewriting note/code content. |
| Principal/scope and internal endpoints | FastAPI dependencies + Nest authorization + deployment isolation | Authenticate the service caller, bind scope to an authorization decision, reject before embeddings/inference. Do not make the model decide authorization. |
| Tool names, capabilities and skill access | Small custom LangChain tool middleware + loader validation | Check all executions, including requests originating from untrusted context. Tool filtering alone is not an execution gate. |
| Call budgets | Existing built-in limit middleware | Keep 10/6 initially; add deadline and parallel-batch tests, not a replacement counter. |
| Action approval | Application-owned validated action policy | For actions without clear current-user authorization, return a proposal requiring explicit approval bound to action/arguments/user/scope. HumanInTheLoopMiddleware is an option only with a designed checkpoint/resume contract; adding it alone would not work with today's plain-text streaming API. |
| Secrets/PII | Targeted detectors, sink-specific policy, optionally installed PIIMiddleware | Block credentials from logs, memory and external egress; preserve legitimate personal-assistant recall of names/contact details to the authorized user. Measure false positives before blanket PII redaction. |
| RAG safety | Authenticated scope, constrained response shape, source IDs, calibrated scores | Similarity is relevance evidence, not an instruction-trust score. Keep backend memory thresholds and tune against data. |
| Reliability | Explicit network timeouts, bounded concurrency, managed task lifecycle | Retry transient reads only within a deadline. Do not blindly retry writes; resolve ambiguous completion with idempotency/status. |

**No new specialized guardrail library is recommended now.** [NeMo Guardrails](https://docs.nvidia.com/nemo/guardrails/latest/home) adds programmable policy checks and flow configuration; Priora's immediate gaps are simpler authorization, contract and lifecycle defects. [Guardrails AI](https://github.com/guardrails-ai/guardrails) supplies validation infrastructure, but another output-validation stack is not justified while Pydantic already handles structured extraction. [Presidio](https://presidio.dataprivacystack.org/) offers configurable PII detection/anonymization; consider it only if measured multilingual detection requirements exceed targeted existing middleware. Its own documentation notes detection is not exhaustive. These three packages are not established as installed or integration-compatible here; no version-specific integration is promised or tested. A future adoption ticket must pin versions, benchmark EN/AR false positives, latency and streaming behavior, and justify operational cost.

Supabase storage review is limited to the application caller and signed-link policy; bucket ACLs, service-key privileges and database RLS were not queried. The requested changelog markdown fetch was unavailable through the documentation tool, and no storage API change is proposed on assumed compatibility.

## 6. Prioritized Implementation Tickets

Each ticket maps to one finding, so priorities total 11 P1 and 4 P2. No P0 is currently assigned. Acceptance tests below are proposed work, not tests passed by this audit. Implement inside existing modules; suggested new test locations are not files created during this audit.

### Phase 1 — Input Guardrails

#### GR-IN-01 — Restore the UUID chat contract (P1)

- **Problem/impact and evidence:** F01; `schemas.py:11` rejects normal backend UUIDs (`schema.prisma:50-51`).
- **Solution/components:** use Pydantic UUID validation and canonical string serialization for `mindSpaceId`; audit the pre-existing local edit with its owner. Modify `agent-service/src/agentcore/schemas.py`; keep ContextVar/tool payload types consistent.
- **Acceptance criteria:** ordinary backend UUID reaches the handler; malformed IDs fail before inference; current 10,000-character/whitespace controls remain effective.
- **Required tests:** valid hyphenated UUID, malformed/empty ID, existing backend-to-Agent payload fixture, canonical serialization to downstream RAG/CRUD calls.
- **Dependencies:** none. **Complexity:** Small.

#### GR-IN-02 — Authenticate and bind service requests to authorized scope (P1)

- **Problem/impact and evidence:** F02; `main.py:38-61`, `ragcore/main.py:23-79`, Compose network declarations.
- **Solution/components:** establish authenticated Nest→Agent and trusted-service→RAG calls using existing configuration patterns; use a FastAPI dependency to validate caller and an authorization-bound MindSpace before work. Keep Nest authoritative: validate bearer/scope through a narrowly scoped Nest check or a short-lived signed context issued after ownership verification. Select one contract rather than layering both speculatively. Restrict development binds and remove unnecessary shared-network membership. Protect ingest/embed as well as search.
- **Acceptance criteria:** missing/invalid service proof and mismatched scope fail before model/embedding/storage access; possession of a UUID is insufficient; legitimate ingestion and chat still work; deployment review records actual reachable networks.
- **Required tests:** anonymous direct calls, valid caller with foreign scope, tampered/expired context, ingest into another scope, correct two-user flow, service outage fails closed, deployment connectivity tests from approved/unapproved networks.
- **Suggested files:** Agent/RAG `main.py`, configuration modules, `backend/src/agent/agent.service.ts`, `backend/src/documents/rag.service.ts`, `tools/knowledge.py`, memory embedding client and Compose files.
- **Dependencies:** GR-IN-01 for positive chat tests. **Complexity:** Medium. Escalate to P0 if exposed cross-tenant retrieval is reproduced.

#### GR-IN-03 — Bound and type request/history contracts (P1)

- **Problem/impact and evidence:** F03; untyped history, full-history read, weak public message DTO.
- **Solution/components:** define user/assistant-only history items with bounded string content, entry count and aggregate budget. Reject caller system/tool roles, multimodal objects and unknown keys unless explicitly supported. Bound incoming body size before parsing at the service/proxy boundary. Limit retrieved history at Nest with an explicit truncation policy. Declare optional `sourceMessageId` before forbidding extras; coordinate rollout so current Nest payloads do not break.
- **Acceptance criteria:** malformed/untrusted roles fail before prompt construction; excessive request/history budgets produce controlled errors; ordinary EN/AR and code/quoted instructions survive unchanged. Nest and Python agree on message bounds.
- **Required tests:** system/developer/tool roles, scalar/list entries, missing content, oversized aggregate history, whitespace/Unicode, unknown metadata, large body, history-window order, exact-content preservation.
- **Suggested files:** `schemas.py`, `main.py`, Nest `create-message.dto.ts`, `conversation-messages.service.ts`, `agent.dto.ts`.
- **Dependencies:** GR-IN-01. **Complexity:** Medium.

### Phase 2 — Tool Execution Guardrails

#### GR-TL-01 — Enforce skill catalog and path containment (P1)

- **Problem/impact and evidence:** F04; unconstrained built-in path and disabled-skill loading.
- **Solution/components:** resolve built-ins from the enumerated catalog, verify canonical containment including symlinks, validate prefixes/UUIDs, and enforce owned-and-enabled user-skill loading at execution. Keep generic user-skill editing endpoints usable; add the enabled check specifically for execution semantics.
- **Acceptance criteria:** only registered built-ins and enabled owned user skills load; rejected identifiers never read files or return instructions; controlled errors avoid path disclosure.
- **Required tests:** `..`, absolute paths, Windows drive/backslash variants, symlink escape, missing prefix, unknown catalog key, foreign user, disabled owned skill and valid loads.
- **Suggested files:** `skills/skill_loader.py`, `backend/src/user-skills` controller/service as needed, loader tests.
- **Dependencies:** none. **Complexity:** Small.

#### GR-TL-02 — Enforce action intent and external-data policy (P1)

- **Problem/impact and evidence:** F05; fixed universal tools and prompt-only write instructions.
- **Solution/components:** attach a small capability policy to existing tools (read, write, external egress). Enforce with async tool middleware and application-owned authorization context. Permit clearly authorized user actions; otherwise produce a structured proposal and require explicit, scoped approval before execution. Bind approval to canonical arguments, user, MindSpace and expiry; never accept an LLM-produced “approved” flag. Reject credentials/private context in external queries unless an explicitly allowed user-directed data flow applies. Render skill/memory descriptions as labeled data below immutable policy.
- **Acceptance criteria:** untrusted documents/skills/results cannot independently authorize a write or private-data export; current-user requested task/note creation remains usable; stale approvals cannot be replayed or edited.
- **Required tests:** malicious retrieved page requests a note/task, skill requests secret-bearing web URL, benign personal recall, explicit user create, changed arguments/scope after approval, mixed parallel read/write batch.
- **Suggested files:** `langchain_agent/agent.py`, `langchain_agent/tools.py`, prompts, tool wrappers, Nest chat/action contract and frontend only if proposal approval UX is selected.
- **Dependencies:** GR-IN-02, GR-IN-03, GR-TL-01. **Complexity:** Large (approval semantics and streaming UX, not a new agent framework).

#### GR-TL-03 — Bound execution time and own background-task lifecycle (P1)

- **Problem/impact and evidence:** F06; memory HTTP calls have no timeout, skill listing blocks async work, extraction tasks detached, cleanup starts too late.
- **Solution/components:** move context setup/use under a reliable try/finally; offload or use existing async HTTP client for skill calls. Set explicit model/network timeouts and one request deadline, plus bounded extraction concurrency. Track extraction tasks and consume failures; define whether accepted extraction finishes or cancels on disconnect. Propagate client disconnect through Nest to Python where possible; timeouts on synchronous thread work remain necessary because cancelling an await does not kill its thread.
- **Acceptance criteria:** stalled dependencies cannot run indefinitely; every context set has cleanup; background failures produce sanitized outcomes; graph 10/6 limits stay intact; requests do not block one another during skill lookup.
- **Required tests:** stalled memory/embed/model, skill-list exception before first chunk, cancelled client, two concurrent users, extraction failure, tool parallel limit boundary, ambiguous write timeout with no blind retry.
- **Suggested files:** Agent `main.py`, `langchain_agent/agent.py`, `llm.py`, `memory/memory.py`, `skills/skill_loader.py`, Nest Agent and conversations services/controller.
- **Dependencies:** none; coordinate with GR-OB-01 and GR-OUT-01. **Complexity:** Medium.

#### GR-TL-04 — Remove the cross-user diagnostic enqueue path (P1)

- **Problem/impact and evidence:** F15; `documents.controller.ts:43-45`, `documents.service.ts:105-131`.
- **Solution/components:** remove/disable the diagnostic route in application builds, or restrict it to an explicitly authorized administrative test operation. If retained for user testing, require a specified owned document and never choose a global READY row. Do not rely on an ignored `forceFail` field.
- **Acceptance criteria:** an ordinary user cannot enqueue another user's document; production diagnostic access is explicitly unavailable or governed.
- **Required tests:** two-user READY documents, anonymous/ordinary/admin requests as applicable, no-READY state, no enqueue on denial.
- **Suggested files:** documents controller/service and processor tests.
- **Dependencies:** none. **Complexity:** Small.

#### GR-TL-05 — Tighten active tool schemas and resource bounds (P2)

- **Problem/impact and evidence:** F13; function-derived schemas differ from legacy dictionaries; large outputs and exceptions are inconsistent.
- **Solution/components:** add bounded Pydantic argument schemas to the active tool wrappers, including executor enum, text lengths and valid dates; retain backend validation. Cap PDF complexity/bytes, upload size, and list-result projection/pagination. Normalize expected dependency/validation errors with stable codes; rethrow programming faults to sanitized logging. Use idempotency for retried writes rather than relying only on a two-minute lookup.
- **Acceptance criteria:** invalid inputs rejected before HTTP calls; oversized work bounded; no raw exception text in user/tool results; real successes and failures remain distinguishable.
- **Required tests:** invalid executor/date, oversized Markdown/table/list, malformed upstream JSON, 401/404/429/5xx, transient read retry, concurrent duplicate write and ambiguous timeout.
- **Suggested files:** active `langchain_agent/tools.py`, `tools/*.py`, relevant Nest DTOs/upload interceptors and write services.
- **Dependencies:** GR-TL-03; reuse GR-TL-02 policy. **Complexity:** Medium.

### Phase 3 — Output Guardrails

#### GR-OUT-01 — Validate output before delivery and report completion explicitly (P1)

- **Problem/impact and evidence:** F08; direct token emission and middleware terminal messages not explicitly surfaced.
- **Solution/components:** define a small output policy for credentials, unexpected data exposure, empty/invalid responses and tool-success claims. First ship a bounded whole-answer buffer for content requiring pre-release checks, with an explicit latency tradeoff; use tested rolling buffering only for checks that can safely operate incrementally. Consume graph completion/error/limit state separately from model text. Give Nest an explicit success/interrupted/blocked outcome; persist successful text consistently and label partial outcomes if retained. Cancel upstream readers on disconnect and honor backpressure.
- **Acceptance criteria:** planted secrets cannot escape across chunk boundaries; limit exhaustion has a visible controlled result; interrupted output is not silently labeled complete; tool results remain internal; authorized personal data and valid download links are not indiscriminately removed.
- **Required tests:** split-token credential, empty model response, exception after first chunk, six-model/ten-tool limits, middleware terminal output, mixed tool/text stream, disconnect, tool-failure followed by fabricated success, benign PII recall.
- **Suggested files:** `langchain_agent/agent.py`, FastAPI response adapter, Nest `agent.service.ts`, conversations service/controller, client stream handler if contract changes.
- **Dependencies:** GR-TL-03; coordinate GR-OB-01 detectors and GR-MR-03 citations. **Complexity:** Medium.

#### GR-OUT-02 — Define generated-document capability lifetime (P2)

- **Problem/impact and evidence:** F14; ten-day bearer links and no demonstrated cleanup policy.
- **Solution/components:** choose documented link expiry and generated-file retention appropriate for personal documents; shorten configurable URL lifetime, omit capability tokens from logs/traces, and define cleanup/renewal. Preserve authenticated upload and user-derived storage keys. Decide explicitly whether generated PDFs are user-scoped or MindSpace documents before changing data models.
- **Acceptance criteria:** expiry is documented/testable; legitimate recipient can download within policy; copied/expired URL behavior is understood; retention cleanup has ownership protections.
- **Required tests:** signed URL before/after expiry using test storage, no URL token in logs, user-bound renewal if supported, cleanup only expired generated objects.
- **Suggested files:** `backend/src/documents/storage.service.ts`, generated upload handler, PDF tool result projection/configuration.
- **Dependencies:** GR-OB-01; product retention decision. **Complexity:** Small for expiry policy; cleanup/renewal may be a separate Medium follow-up if required.

### Phase 4 — Memory and RAG Guardrails

#### GR-MR-01 — Validate retained memory and preserve provenance (P1)

- **Problem/impact and evidence:** F09; weak extraction schema, automatic persistence and absent source ID.
- **Solution/components:** constrain content length/count, finite scores 0–1, nested entity/participant shapes and dates in Python and Nest. Apply a retention policy that rejects credentials and behavioral override instructions while preserving legitimate personal facts. Add source-message provenance with a stable server-owned identity; coordinate existing save-after-stream behavior so references are valid even on interrupted runs. Keep extraction prompts and duplicate/salience checks; add a decision stage before persistence.
- **Acceptance criteria:** invalid/secret-bearing extraction is not stored; source user/scope cannot be model-selected; facts retain attribution and uncertain statements remain uncertain; malformed nested items yield controlled validation outcomes.
- **Required tests:** invalid scores/dimensions/nested objects, empty/huge content, prompt-injection memory, credential retention, hypothetical versus actual event, source ID on interrupted chat, concurrent users and both backend query filters.
- **Suggested files:** `schemas.py`, `memory/memory.py`, extraction prompts, Nest memory DTOs/services and conversation provenance path; schema migration only if required by selected provenance design.
- **Dependencies:** GR-IN-02, GR-IN-03, GR-TL-03. **Complexity:** Medium.

#### GR-MR-02 — Stop retrieval of deleted documents (P1)

- **Problem/impact and evidence:** F10; SQL/storage deletion does not invalidate Qdrant points.
- **Solution/components:** add an authenticated, scoped vector deletion/tombstone path keyed by source ID and MindSpace. Make deletion fail closed for retrieval immediately (for example via authoritative active-document filtering) while cleanup retries. Coordinate pending ingestion so a delayed job cannot resurrect deleted vectors. Reuse existing processing infrastructure where helpful.
- **Acceptance criteria:** deleted document content is unavailable to subsequent retrieval, including cleanup failure and delayed/retried ingestion; another scope cannot delete its vectors.
- **Required tests:** ingest→retrieve→delete→no-result, failed vector cleanup, duplicate deletion, stale queued ingest, two-user/source collision attempt.
- **Suggested files:** documents service/processor/RAG client, RAG authenticated endpoints and Qdrant client.
- **Dependencies:** GR-IN-02. **Complexity:** Medium.

#### GR-MR-03 — Bound retrieval and validate evidence attribution (P2)

- **Problem/impact and evidence:** F11; raw RAG contracts/results and no calibrated search cutoff or citation validation.
- **Solution/components:** Pydantic RAG query/ingestion/embed schemas, bounded topK/batch/text sizes, explicit minimal result schema with source/chunk IDs, score and bounded text. Calibrate a document relevance threshold on existing RAG data; preserve existing memory thresholds. Treat retrieved text as untrusted data; validate cited IDs against returned evidence and use an insufficient-evidence response when appropriate. Do not invent a review workflow merely because `approved` exists in payloads.
- **Acceptance criteria:** malformed/oversized RAG requests fail predictably; irrelevant results can be empty; source attribution cannot cite unseen IDs; document instructions do not gain system authority.
- **Required tests:** negative/huge topK, malformed ingest, excessive embed batch, unrelated query, grounded answer, false source ID, multilingual evidence, injected retrieval text and regression retrieval metrics.
- **Suggested files:** `ragcore/main.py`, Qdrant result projection, `tools/knowledge.py`, prompts, existing RAG/agent evaluation modules.
- **Dependencies:** GR-IN-02, GR-MR-02. **Complexity:** Medium.

### Phase 5 — Guardrail Evaluation and Observability

#### GR-OB-01 — Remove sensitive logging and add safe guardrail events (P1)

- **Problem/impact and evidence:** F07; content-rich prints/traces and credential literal.
- **Solution/components:** remove the literal and assess validity/history exposure privately; revoke/rotate only credentials actually at risk, without putting them in tickets or reports. Replace payload logs with request IDs, tool name, policy code, stage, latency, counts and safe status. Redact credentials/signed-link query tokens before every logging/tracing sink. Configure LangSmith input/output handling, access, sampling and retention; do not assume Python log redaction also scrubs nested LangChain traces.
- **Acceptance criteria:** synthetic credential and personal-data canaries are absent from normal logs and configured trace exports; denied tool/memory/output actions remain measurable; incident records contain no raw bearer tokens.
- **Required tests:** capture logs across success/error paths, nested model/tool/retriever traces, signed URL token, unauthorized scope attempt, extraction failure, trace-disabled operation.
- **Suggested files:** Agent config/logging sites, memory module, RAG embed logging, Nest chunk logging and trace setup.
- **Dependencies:** none; execute early despite phase grouping. **Complexity:** Medium.

#### GR-OB-02 — Extend Evaluation V1 with security and wire-path tests (P2)

- **Problem/impact and evidence:** F12; quality checks do not exercise the production stream/memory/auth boundaries.
- **Solution/components:** retain the nine cases and four existing evaluators. Add deterministic negative tests plus adversarial/benign paired examples; check tool arguments/order/count, persisted effects, transmitted bytes and expected empty retrieval. Use isolated synthetic tenants and side-effect-safe tools for adversarial tests; require deliberate opt-in for live tools/LangSmith publication. Retire or repair the obsolete local runner imports without creating a competing framework. Add run metadata for model/dependency/policy/dataset versions.
- **Acceptance criteria:** existing quality results remain available; every P1 has a deterministic regression; attack success, false positives, false negatives, skipped-evaluator counts and latency are reported separately; CI fails on boundary regressions, not merely on an LLM judge's impression.
- **Required tests:** matrix in section 8, evaluation fixture isolation, no unintended external publication, malformed judge JSON/range, repeated tool calls that pass set matching but violate budget.
- **Suggested files:** `evals/langsmith_runner.py`, `dataset.json`, `mock_tools.py`, older runner and new focused HTTP/stream/backend tests.
- **Dependencies:** test harness can begin immediately; final release gates depend on all relevant P1 fixes. **Complexity:** Medium.

## 7. Implementation Roadmap

1. **Contain and restore:** GR-IN-01, GR-IN-02, GR-TL-04 and GR-OB-01. Establish actual deployment reachability before deciding whether F02 is P0. Verify normal chat and deny foreign-scope/direct callers before broader rollout.
2. **Make execution bounded:** GR-IN-03, GR-TL-01 and GR-TL-03. Keep existing 10/6 limits; add explicit time/resource/lifecycle boundaries and deterministic isolation tests.
3. **Protect actions and retained data:** GR-TL-02, GR-MR-01 and GR-MR-02. User intention, memory provenance and deletion semantics must be explicit before expanding agent capabilities.
4. **Protect delivered output:** GR-OUT-01 alongside the previous stage; no release claim of “stream-safe” until tests inspect actual emitted bytes. Then GR-TL-05, GR-MR-03 and GR-OUT-02.
5. **Measure and release:** extend GR-OB-02 throughout, then run the full matrix against frozen dependency/model versions. Use an isolated staging environment for live integration; keep real-tool/LangSmith publication opt-in.

Phases are logical ownership groups, not a reason to postpone privacy work until phase 5. No architectural rewrite, replacement agent loop, broad moderation service, new autonomous task executor, or replacement Evaluation V1 is proposed.

## 8. Guardrail Testing and Evaluation Strategy

### Checks actually performed

An isolated `runpy.run_path` load of `schemas.py` using `agent-service/.venv/Scripts/python.exe -B` exercised synthetic values only. It did not import the configured application or contact services.

| Probe | Observed result |
|---|---|
| Standard hyphenated UUID as MindSpace ID | Rejected: `string_too_long` |
| Whitespace-only message | Rejected by custom validator |
| Message length 10,001 | Rejected: `string_too_long` |
| History containing a system-role item | Accepted |
| History containing integer `42` | Accepted |
| Extra `sourceMessageId` | Accepted but omitted from model |
| Empty profile content and confidence 8 | Accepted by Python model |
| Empty event summary, integer nested items and salience 8 | Accepted by Python model |

These establish schema behavior only. No middleware execution, end-to-end service behavior, exploit success, production exposure, storage ACL, or LangSmith quality score is claimed as tested. Existing scripts that may write reports, call real tools or upload traces were not run. Postman initialization/status was not used: no Postman setup underpins this source audit, and the user permits only this report as a filesystem change.

### Required future matrix

| Layer | Cases | Deterministic evidence |
|---|---|---|
| Request/auth | Valid/invalid UUID; malformed/oversized/history-role injection; anonymous/foreign-scope requests | HTTP status, no downstream calls on rejection, bounded resource use |
| Tenant isolation | Two users, two MindSpaces, concurrent and cancelled runs; user skills; memory and RAG | Exact requested scope, zero foreign rows/results, ContextVars cleaned |
| Tool execution | Unknown tool, wrong enum, parallel excess calls, expired approval, injected write/egress | Executed tool names/arguments/counts, denied calls never reach backend/provider |
| Reliability | Slow/hung network/model, malformed JSON, 429/5xx, disconnect, task exception | Deadline completion, no unbounded live tasks, safe error code, no duplicate writes |
| Output | Split secret, partial text, tool failure/success claims, middleware limit message | Actual client bytes, completion status and persisted response agree |
| Memory | Hypotheticals, malicious “remember” instructions, credentials, poor confidence, malformed entities | Stored rows/absence, source provenance, no cross-scope state |
| RAG | Unrelated query, missing citation, hostile PDF text, deleted/late-ingested source | Allowed source IDs, empty-result semantics, zero deleted-document retrieval |
| Privacy | Benign names/phone recall versus credentials/export requests | Legitimate recall preserved; zero canary leakage in logs/traces/external requests |
| Evaluation | Repeated tool calls, expected empty RAG, skipped context, bad judge output | Separate deterministic scores, skip count, evaluator failure count |

Use synthetic secrets only. Pair attack cases with benign quoted instructions, code, personal names and EN/AR requests to avoid measuring only refusals. For each policy, label expected allow/block outcomes and report:

- False-positive rate = benign allowed cases incorrectly blocked / labeled benign allowed cases.
- False-negative rate = prohibited cases incorrectly allowed / labeled prohibited cases.
- Attack success rate based on actual forbidden effects or emitted data, not whether the answer sounds compliant.
- Per-category sample counts, repeated runs for stochastic cases, quality regression against V1, p50/p95 latency, timeout/cancellation rate and extraction-task failure rate.

Initial deterministic release gates: zero cross-tenant results, zero forbidden side effects, zero planted-credential leakage, all configured budgets respected, and no unhandled lifecycle failures in the test corpus. These finite tests are not proof of universal prompt-injection resistance. Establish a measured benign baseline and agree false-positive thresholds before deploying semantic blocking; avoid inventing an unsupported target accuracy. Use LLM judges for answer quality, with schema/range validation and manual adjudication samples, not as authorization oracles.

## 9. Open Questions and Assumptions

1. Is the local schema edit intended and deployed? The UUID regression is confirmed for this working tree, not a remote release.
2. What can reach the running Agent/RAG services, including other containers on `n8n_default`, reverse proxies and development hosts? No firewall or deployment inspection was performed.
3. Which source should attest user/scope to Python: a narrow Nest authorization check or a short-lived Nest-issued context? Choose one and document expiry/replay semantics.
4. Which actions already count as explicit user authorization, and when should a proposal require confirmation? Scope the policy to real writes/egress; do not burden harmless read-only assistance.
5. Should memory extraction survive a disconnected chat? How should provenance work when the current implementation only persists conversation messages after streaming finishes?
6. What memory retention/consent and credential-exclusion policy is expected? Personal data is a feature of this assistant; blanket removal would be a functional regression.
7. Is LangSmith tracing enabled in deployment, and what are its destination, retention, access controls and input/output masking? Decorators alone do not answer these questions.
8. Are deleted Qdrant records removed by an external process? None appears in the inspected deletion path. Confirm before sizing GR-MR-02.
9. Are generated documents intentionally user-scoped temporary objects, and what signed-link/retention lifetime is acceptable? Bucket ACLs and external cleanup remain unverified.
10. Does installed PII middleware protect Priora's exact legacy message stream, including chunk-spanning secrets? Installed API support exists; runtime wire coverage still needs proof.
11. What provider restrictions apply to Ollama cloud web fetch, especially private hosts, redirects and URL/query retention? No outbound fetch experiment was performed.
12. Which existing evaluation command is canonical? `langsmith_runner.py` is substantive Evaluation V1; older runner imports appear stale. No prior live pass rate was assumed.

This report is an audit and implementation plan only. Application code, tests, configurations and dependencies were not changed.
