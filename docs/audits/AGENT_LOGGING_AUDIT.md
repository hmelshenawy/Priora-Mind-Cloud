# Agent logging audit

Date: 2026-11-07. Scope: every Python source file under `agent-service/src/agentcore/`. Read-only source/AST inspection: **63 output calls, 6 logger setup calls, 7 commented-out print calls**. No application execution, log-store access, code changes, commits or pushes. Tables group calls with the same decision; line numbers identify call starts.

All paths below are relative to `agent-service/src/agentcore/`. **KEEP** retains a safe purpose/call; **REPLACE** changes its message, level or location; **REMOVE** has no separate replacement. Suggested events are a design, not implemented logging.

## Development logging contract

- Use existing Python logging, configured once at the entry point. INFO: startup and one request outcome. DEBUG: individual stage/tool/model timings and counts. WARNING: rejected requests, expected dependency failures, timeouts and exhausted limits. ERROR: unexpected failures. Normal client disconnect is INFO, not ERROR.
- Attach a server-generated `request_id` to request and background-task events. Use generated `operation_id` when concurrent operations need correlation. Do not use JWTs, content hashes, user names, document names, tenant identifiers or skill descriptions as correlation values.
- Allowed fields: static operation/stage names, registered tool name (unknown names become `unknown`), elapsed milliseconds, counts, byte/character totals, numeric HTTP status, sanitized outcome/error code and bounded exception class. Render proposed `{fields}` below from that allowlist only.
- Never log raw user messages, prompts, history, memories, documents, embeddings, tokens, secrets, tool arguments, full tool responses, arbitrary URLs or signed download links—even at DEBUG. Truncation is not redaction. Do not stringify request/response/config objects.
- Do not log `str(exc)`, raw `ValidationError.errors()` or unsanitized `logger.exception` output: exception text/input fields may contain payloads. For unexpected development failures, capture sanitized module/function/line stack locations without exception text, source-line contents or locals. Preserve exception propagation and cancellation behavior.
- Log each failure once at the operation boundary; the request outcome references its safe code without repeating the traceback. For long calls, DEBUG start/end events are useful; do not emit a log per token or HTTP chunk. Keep SDK HTTP/wire logging off unless proven content-free.

## Active runtime: existing calls

`main.py:5` selects `langchain_agent.agent.Agent`; it uses `langchain_agent.llm.LangChainOllama`, shared tools, memory and skills. The older Agent/LLM modules are imported for shared base/types but their alternative execution methods are not the active HTTP path.

| File and line | Current log purpose | Decision | Recommended replacement / level |
|---|---|---|---|
| `main.py:50` | Fetch and print user-skill list | REMOVE | No logging-driven extra fetch. Record count once during the existing skill-list operation below. |
| `main.py:51` | Check legacy registry contains `load_skill` each request | REMOVE | Active tool inventory is reported once at startup. |
| `langchain_agent/agent.py:31` | Startup registered tool names | KEEP | INFO; static registered tool names only. Combine with startup count if desired; once per process. |
| `langchain_agent/agent.py:36` | Dump `load_skill` argument schema | REMOVE | Static schema adds routine noise; inspect it in a targeted schema test. |
| `langchain_agent/agent.py:78` | Per-message role/type/content excerpts | REMOVE | No per-message logs; context-size event below is sufficient. |
| `langchain_agent/agent.py:95` | Debug streamed tool-call fragments/arguments | REMOVE | Log one actual tool-operation event, not partial generated arguments. |
| `langchain_agent/agent.py:101` | Full tool response | REPLACE | DEBUG `tool.completed tool={registered_name} outcome={outcome} duration_ms={ms}` at the execution wrapper. This stream site lacks reliable timing; do not fabricate it. |
| `langchain_agent/agent.py:166` | Full built context | REPLACE | DEBUG `context.ready history_count={n} context_chars={n} profile_count={n} event_count={n}`; calculate counts before rendering content. |
| `langchain_agent/agent.py:174,175` | Retrieved event/profile objects | REMOVE | Use the memory retrieval summaries below; avoid duplicate counts and payloads. |
| `memory/memory.py:51` | Profile extraction started | REPLACE | DEBUG `memory.extract.started kind=profile`; add outcome at the task boundary. |
| `memory/memory.py:79,270` | Embedding request started | REPLACE | DEBUG `embedding.started kind={profile_or_event} item_count={n}`; paired completion records dimensions and duration, never text/vector. |
| `memory/memory.py:118` | Duplicate profile memory plus its content | REPLACE | DEBUG `memory.persist.completed kind=profile saved_count={n} duplicate_count={n} duration_ms={ms}`; aggregate once per batch, including duplicate-only batches. |
| `memory/memory.py:121` | Print memories as “saved” **before** HTTP status check | REPLACE | Merge into the preceding batch summary, emitted only after successful status checks. Failures use `memory.persist.failed kind=profile status={status} error_code={code}` at WARNING/ERROR. |
| `memory/memory.py:122` | Bare persistence HTTP status | REMOVE | Include numeric status in the operation failure event; no standalone status line. |
| `memory/memory.py:123` | Raw persistence response body | REMOVE | No body replacement. Success/failure and counts suffice. |
| `memory/memory.py:149` | Profile retrieval started | REPLACE | DEBUG `memory.retrieve.started kind=profile`. |
| `memory/memory.py:152` | Number of profile memories retrieved | REPLACE | DEBUG `memory.retrieve.completed kind=profile result_count={n} duration_ms={ms}`. |
| `memory/memory.py:180` | Event extraction started | REPLACE | DEBUG `memory.extract.started kind=event`; add outcome at the task boundary. |
| `memory/memory.py:182` | Event-extraction messages, including history | REMOVE | No content replacement. |
| `memory/memory.py:313` | Duplicate event index and summary | REPLACE | DEBUG `memory.persist.completed kind=event saved_count={n} duplicate_count={n} duration_ms={ms}`; one batch event, not per-event summaries. |
| `memory/memory.py:318` | Saved event index and summary | REPLACE | Merge into the preceding batch event after successful writes. Partial failure records safe counts and status, not “all saved.” |
| `memory/memory.py:343` | Event retrieval started | REPLACE | DEBUG `memory.retrieve.started kind=event`. |
| `memory/memory.py:351,352` | Before/after relevance-filter counts | REPLACE | One DEBUG `memory.retrieve.completed kind=event candidate_count={n} result_count={n} duration_ms={ms}`. |
| `skills/skill_loader.py:58` | Built-in skill metadata catalog | REPLACE | DEBUG `skills.list.completed source=builtin count={n}`; once at startup/catalog refresh, not every repeated enumeration. |
| `tools/tools.py:34` | Weather result, including requested location | REMOVE | Common tool completion event covers it; no location or weather payload. |
| `tools/web_fetch.py:52` | Print full exception text | REPLACE | WARNING `tool.failed tool=webFetch error_code={code} error_type={class}` for expected provider failures; ERROR for unexpected faults. Prefer the common tool boundary; do not repeat there and here. |
| `utils/service_verfication.py:23` | Missing internal-key failure | KEEP | WARNING; existing generic message is safe. Add generated request correlation, not the key/header. |
| `utils/service_verfication.py:27` | Invalid internal-key failure | KEEP | WARNING; existing generic message is safe. Never include supplied/expected values. |
| `utils/service_verfication.py:30` | Service auth success for every request | REPLACE | DEBUG `service_auth.accepted`; omit at INFO because request lifecycle already establishes acceptance. |

These rows cover **32 active-path output calls**. Counts/status messages are safe in substance, but `print()` is replaced so levels and correlation work consistently.

## Logger setup (all six calls)

| File and line | Current purpose | Decision | Recommendation |
|---|---|---|---|
| `main.py:13` | Configure root logging at INFO | REPLACE | Configure once during startup with request correlation and a development DEBUG option for `agentcore` only. Keep noisy dependency loggers at WARNING or their safe production level. |
| `main.py:14` | Module logger | KEEP | No emitted message or level change. |
| `langchain_agent/agent.py:14` | Module logger | KEEP | No emitted message or level change. |
| `utils/service_verfication.py:7` | Configure root logging again during import | REMOVE | Entry-point configuration owns logging. This import occurs before `main.py` configuration and can preempt it. |
| `utils/service_verfication.py:8` | Module logger | KEEP | No emitted message or level change. |
| `agent.py:12` | Module logger in shared/legacy module | KEEP | Harmless setup; legacy method logs remain governed by the next table. |

## Legacy, workflow and standalone/evaluation output

All **31 remaining output calls** are covered here. They are not evidence of active HTTP logging, but should not leak content when developers invoke them. Do not refactor or activate these paths merely to add logs.

| File and line | Current log purpose | Decision | Recommended replacement / level |
|---|---|---|---|
| `agent.py:77,101,258,316` | History, user message, context and completed chat content | REMOVE | If invoked, use content-free request/context lifecycle events. |
| `agent.py:83,110` | Legacy loop step | REPLACE | DEBUG `model.started iteration={n}`; one per invocation, not chunk. |
| `agent.py:148,149` | Retrieved event/profile objects | REPLACE | One DEBUG `memory.retrieve.completed profile_count={n} event_count={n}`. |
| `agent.py:195` | Generated tool name | REPLACE | DEBUG `tool.started tool={registered_name}`; unknown/unregistered value becomes `unknown`. |
| `agent.py:196,197` | Tool arguments/result | REMOVE | Use safe completion status/counts only. |
| `agent.py:280,335` | Raw exception string | REPLACE | WARNING/ERROR `tool.failed tool={registered_name} error_code={code} error_type={class}`; safe stack locations only for unexpected faults. |
| `llm.py:44,45,46` | Legacy model content, thinking and tool calls | REPLACE | One DEBUG `model.completed duration_ms={ms} tool_call_count={n} output_chars={n}`; never reasoning text or arguments. |
| `workflows/chat/workflow.py:44` | Alternative workflow iteration | REPLACE | DEBUG `model.started iteration={n}`. |
| `workflows/chat/workflow.py:77` | Tool result | REPLACE | DEBUG `tool.completed tool={registered_name} outcome={outcome} duration_ms={ms}`. |
| `workflows/chat/workflow.py:118` | Raw tool exception | REPLACE | WARNING/ERROR `tool.failed tool={registered_name} error_code={code} error_type={class}`. |
| `workflows/chat/workflow.py:146` | Retrieved memories | REPLACE | DEBUG `memory.retrieve.completed kind=profile result_count={n}`. |
| `test.py:14` | Legacy streamed model content | REPLACE | DEBUG `stream.completed chunk_count={n} output_chars={n}` after iteration; assertions for content belong in synthetic tests, not output logs. |
| `langchain_agent/test.py:18` | Print streamed reply | REPLACE | DEBUG `stream.completed chunk_count={n} output_chars={n}` once after the stream, not per chunk. |
| `langchain_agent/test.py:20` | Formatting newline after reply | REMOVE | Unnecessary after removing reply printing. |
| `evals/runner.py:118` | Per-case result object containing input, arguments/results | REPLACE | DEBUG `eval.case.completed case_index={n} passed={bool} tool_call_count={n}`. |
| `evals/runner.py:120` | Aggregate accuracy | REPLACE | INFO `eval.completed case_count={n} accuracy={score} failed_count={n}`; retain metric, use logger. |
| `evals/langsmith_runner.py:128` | Raw judge output | REMOVE | Parse success/failure, schema code and numeric score are enough. |
| `evals/langsmith_runner.py:129` | Model finish reason | REPLACE | DEBUG `eval.judge.completed finish_reason={allowed_reason} duration_ms={ms}`; map unknown values to `unknown`. |
| `evals/langsmith_runner.py:381,383` | Dataset created/already exists | REPLACE | DEBUG `eval.dataset.ready created={bool}`; no need for arbitrary dataset names. |
| `evals/langsmith_runner.py:406,413` | Updated/added example with question text | REPLACE | One INFO `eval.dataset.synced added_count={n} updated_count={n} unchanged_count={n}` after synchronization. |

## Commented-out debug calls (not executing)

| File and line | Current purpose | Decision | Replacement |
|---|---|---|---|
| `llm.py:23` | Disabled full LLM context print | REMOVE | None; do not re-enable. |
| `memory/memory.py:185` | Disabled extracted event dump | REMOVE | None. |
| `tools/tools.py:30` | Disabled full weather HTTP response | REMOVE | None. |
| `evals/runner.py:100,101,103,104` | Disabled ad-hoc skill success/length/failure/type prints | REMOVE | Use shared skill-load outcome events if that path is exercised. |

## Missing active-runtime events

These are insertion recommendations, not existing calls. Add them at shared boundaries instead of adding repetitive logs inside each tool. Fields such as duration/outcome need to be measured there; they cannot be inferred from a streamed response fragment.

| File and line / boundary | Missing purpose | Decision | Recommended message / level |
|---|---|---|---|
| `main.py:39-61` request/response generator | Accepted request → complete/failure/cancel | REPLACE existing request debug approach | DEBUG `chat.started history_count={n}`; INFO `chat.finished outcome={completed_or_failed_or_cancelled} duration_ms={ms} output_chars={n} model_calls={n} tool_calls={n}` once in finalization. Count after yielding; do not call generator creation “completed.” |
| `main.py:16,39` validation boundary | Malformed request visibility | KEEP validation behavior; add safe event | WARNING `request.rejected status=422 error_count={n}` without input values, auth headers, or raw validation-error serialization. Use a bounded field/error-code allowlist if more detail is needed. |
| `langchain_agent/agent.py:41-53,87-113` graph model/tool execution | LLM/tool start, latency and failure | REPLACE payload tracing with lifecycle events | DEBUG `model.started stage={chat_or_extraction_or_salience} iteration={n}` / `model.completed duration_ms={ms} tool_call_count={n}`; DEBUG `tool.started tool={registered_name}` / `tool.completed ...`; WARNING/ERROR `operation.failed stage={stage} error_code={code} error_type={class}`. Use existing LangChain hooks/callbacks or a small wrapper, not a new logging framework. |
| `langchain_agent/llm.py:16-24` structured model calls | Extraction/salience validation failure | KEEP model behavior; add safe event | Record schema name from a fixed allowlist, duration and `error_code=structured_output_invalid`. Never dump the model response or Pydantic input details. Avoid duplicating an already instrumented model boundary. |
| `langchain_agent/agent.py:45-53` existing budget middleware | Limit termination versus normal completion | KEEP limits; add safe outcome | WARNING `agent.limit_reached limit_kind={tool_or_model} limit={n}`. Derive from graph state/outcome, not a substring search of model text. |
| `langchain_agent/agent.py:85-86`; `memory/memory.py:49-69,178-203` | Detached extraction completion/failure | REPLACE fire-and-forget observability | DEBUG `memory.extract.completed kind={kind} extracted_count={n} retained_count={n} duration_ms={ms}`; WARNING/ERROR `memory.extract.failed kind={kind} error_code={code} error_type={class}`. Track task outcomes so failures are consumed; mark cancellation explicitly. Preserve parent request ID even after response completes. |
| `skills/skill_loader.py:76-111,152-158` | User skill listing/loading outcome | KEEP execution behavior; add safe event | DEBUG `skills.list.completed source=user count={n} duration_ms={ms}` and `skill.load.completed source={builtin_or_user} outcome={outcome} duration_ms={ms}`. Never identifier, path, description or instructions; malformed prefixes use `source=unknown`. |
| `tools/knowledge.py:19-39`; `tools/tasks.py:33-51`; `tools/notes.py:24-44`; `tools/web_search.py:35-56`; `tools/web_fetch.py:30-53`; `tools/pdf_generator.py:265-291` | Returned failures and provider errors | REPLACE raw/generic-only diagnostics with shared outcome | Normalize a safe internal outcome/status for logging. HTTP/tool failure returned as a dictionary/string is still failure even if the Python call returns normally. A `ToolMessage` or lack of exception alone does not establish success. Log operation name/status/duration, never query, URL, note/task fields, filename or result body. |

The active LLM adapter and tools `notes`, `tasks`, `knowledge`, `web_search`, `google_travel_api` and `pdf_generator` currently have no explicit output calls. Their silence should be addressed through shared operation events, not through new result dumps. No additional print/logger/debugger/stdout calls were found in the remaining Python files, including schemas/context, research workflow and package initializers.

## Streaming and trace behavior

For a development request, DEBUG should expose the sequence `chat.started` → retrieval/skills/context → model/tool operations → `chat.finished`. Optional `stream.first_chunk elapsed_ms={ms}` is enough to distinguish slow inference from a stalled output path; no chunk content or per-chunk event is needed. Profile/event extraction runs concurrently and may complete after chat: log its outcome separately, never report memory persistence as finished merely because the chat stream ended.

`@traceable` is a second output channel: `langchain_agent/agent.py:71,170` and `memory/memory.py:49,147,178,341` capture chat/retrieval/extraction data unless configured otherwise. **REPLACE content-bearing tracing with redacted/metadata-only tracing, or disable it** until nested model/tool spans are verified. Evals also upload examples through `evals/langsmith_runner.py:359-413,433-448`; use synthetic examples and explicit publication intent. Removing `print()` does not change these exports. Do not assume hiding only the parent span masks child spans.

Minimal verification after implementing this design: synthetic canaries absent from console and trace exports; one correlated request outcome on success/failure/disconnect; one outcome per tool and background task; HTTP-error return values not recorded as successful; no false “saved” before status validation; INFO remains short while DEBUG explains timing and failures. This audit did not execute those tests or alter any code. The pre-existing `docs/audits/INPUT_SECURITY_AUDIT.md` was left untouched.
