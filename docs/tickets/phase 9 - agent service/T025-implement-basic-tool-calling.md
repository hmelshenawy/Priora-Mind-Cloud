# T025 — Implement Basic Tool Calling

## Phase
Phase 9 — Agent Service

## Goal
Allow the LLM to request execution of a simple tool instead of only returning plain text.

This ticket is only about basic tool calling.

Do not implement a full multi-step agent loop yet.

## Current Flow

```text
POST /chat
→ OllamaClient
→ model
→ text response
```

## Target Flow

```text
POST /chat
→ LLM
→ tool call?
    ├── no  → return text
    └── yes → execute one tool
              → return tool result
```

## Scope

Implement:
- one simple local tool
- tool schema passed to Ollama
- detection of `tool_calls`
- execution of the requested tool
- return of the tool result
- support for one tool call only

Keep this ticket intentionally small.

## First Tool

Use a deterministic test tool such as:

```python
def get_current_time() -> str:
    ...
```

or another equally simple tool.

Do not connect to NestJS or RAG yet.

## Suggested Structure

```text
src/
└── agentcore/
    ├── main.py
    ├── config.py
    ├── schemas.py
    ├── llm.py
    └── tools.py
```

Avoid creating a registry abstraction unless it is actually needed for this ticket.

## Tool Definition

Use Ollama tool calling support.

The model should receive the tool definition with its name, description, parameters, and types.

Example intent:

```text
User: "What time is it?"
        ↓
LLM sees get_current_time
        ↓
LLM returns tool call
        ↓
Python executes get_current_time()
        ↓
endpoint returns tool result
```

## Important Boundary

`OllamaClient` should handle communication with Ollama.

Tool execution should stay outside the low-level LLM client where practical.

Do not put application/business logic inside the provider client.

## API

Continue using the current chat endpoint.

Example:

```text
POST /chat
```

Request:

```json
{
  "message": "What time is it?"
}
```

A normal message that does not need a tool should still return a normal model response.

## Acceptance Criteria

- At least one local tool exists.
- Tool schema is sent to Ollama.
- Model can return a tool call.
- Code detects whether `response.message.tool_calls` exists.
- Requested tool can be executed.
- Tool arguments are read safely.
- One tool call is supported.
- Normal non-tool responses still work.
- No RAG integration exists.
- No NestJS integration exists.
- No multi-step loop exists yet.
- No unnecessary provider abstractions are added.

## Out of Scope

Do NOT implement:

- full agent loop
- repeated LLM → tool → LLM cycles
- multiple sequential tool steps
- RAG search tool
- NestJS task/note tools
- conversation history
- persistent memory
- retries framework
- generic plugin system
- complex tool registry
- dynamic tool discovery
- permissions system
- authentication between services

## Implementation Rules

- Keep code direct and readable.
- One tool is enough.
- One tool call per request is enough.
- Avoid abstractions that are not needed yet.
- Prefer plain functions.
- Do not create a class only to hold one tool.
- Do not create factory/strategy/registry patterns prematurely.

## Validation

Test at least:

### Case 1 — No tool needed

```text
User: "Hello"
```

Expected:

```text
normal model text response
```

### Case 2 — Tool needed

```text
User: "What time is it?"
```

Expected:

```text
model requests tool
→ Python executes tool
→ tool result is returned
```

## Completion Report

When finished, report:

1. Files created.
2. Files modified.
3. Tool implemented.
4. How tool calls are detected.
5. How tool arguments are handled.
6. Validation results.
7. Any deviation from the ticket and why.
