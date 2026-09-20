# T024 — Implement LLM Client

## Phase
Phase 9 — Agent Service

## Goal
Add the first LLM integration to the Agent service.

Current service:

```text
FastAPI
→ /health
```

After this ticket:

```text
prompt/messages
→ LLM client
→ model response
```

This ticket implements only direct LLM calls. Do not implement tool calling or the agent loop yet.

## Scope

Implement a small LLM client that:

- loads configuration from environment variables
- sends messages to one configured LLM provider
- returns the assistant response
- exposes one simple test endpoint
- keeps the implementation direct and small

Use one provider only in this ticket.

## Provider

Use Ollama for the initial implementation.

Configuration example:

```env
OLLAMA_URL=http://localhost:11434
LLM_MODEL=qwen3
```

Use the model already available in the local Ollama environment.

Do not create a provider abstraction, factory, interface, or multi-provider architecture in this ticket.

## Suggested Structure

```text
src/
└── agentcore/
    ├── __init__.py
    ├── main.py
    ├── config.py
    └── llm.py
```

Suggested class:

```python
class LlmClient:
    def chat(self, messages: list[dict]) -> str:
        ...
```

A simple function is also acceptable if clearer.

## API

### POST /v1/chat

Request example:

```json
{
  "message": "Hello"
}
```

Response example:

```json
{
  "response": "Hello! How can I help?"
}
```

This endpoint is only for validating the LLM client in this phase.

## Flow

```text
POST /v1/chat
    ↓
validate message
    ↓
build messages
    ↓
LLM client
    ↓
Ollama
    ↓
assistant text
    ↓
return response
```

## Message Format

For now, use a minimal message list:

```python
[
    {
        "role": "user",
        "content": message,
    }
]
```

Do not add conversation history, system prompts, memory, or tools yet.

## LLM Client Responsibility

The LLM client should only know:

```text
messages
→ model call
→ assistant response
```

It should not know about:

- RAG
- Qdrant
- NestJS
- PostgreSQL
- tools
- conversations
- users
- MindSpaces

## Error Handling

Fail clearly if:

- model name is missing
- Ollama URL is missing
- Ollama is unreachable
- model call fails
- response is malformed or empty

Do not expose raw secrets or internal stack details in API responses.

## Acceptance Criteria

- Ollama dependency/client is added.
- `OLLAMA_URL` is configurable.
- `LLM_MODEL` is configurable.
- An LLM client exists.
- The client accepts messages.
- The client returns assistant text.
- `POST /v1/chat` exists.
- Sending a normal user message returns a model response.
- No tool calling is implemented.
- No agent loop is implemented.
- No RAG integration is implemented.
- No NestJS integration is implemented.
- Relevant checks/tests pass.

## Out of Scope

Do NOT implement:

- tool schemas
- tool calling
- tool registry
- tool execution
- agent loop
- RAG search
- NestJS business tools
- conversation history
- memory
- system prompt framework
- retries framework
- provider abstractions
- OpenAI integration
- multiple LLM providers
- factories
- unnecessary interfaces/base classes

## Implementation Rules

- Keep it simple.
- One provider only.
- Prefer direct code.
- Do not build a generic LLM framework.
- Do not create abstractions for hypothetical future providers.
- Keep source files small and readable.
- Follow the existing `agentcore` package structure.

## Validation

Before completing the ticket:

1. Start Ollama.
2. Start the Agent service.
3. Call `POST /v1/chat`.
4. Send a simple message such as:

```text
Hello
```

5. Confirm the endpoint returns HTTP 200.
6. Confirm the response contains assistant text.
7. Test behavior when Ollama is unavailable.
8. Run relevant lint/type/test checks.

## Completion Report

When finished, report:

1. Files created.
2. Files modified.
3. Dependencies added.
4. Configuration added.
5. What was implemented.
6. Validation results.
7. Any deviation from the ticket and why.
