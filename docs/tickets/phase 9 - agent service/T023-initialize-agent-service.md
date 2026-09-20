# T023 — Initialize Agent Service

## Phase
Phase 9 — Agent Service

## Goal
Create the initial standalone Python/FastAPI Agent service.

This ticket is foundation only. Do not implement LLM calls, tool calling, agent loops, RAG calls, or NestJS business tools yet.

## Scope
Create a new Python service with:
- FastAPI application
- minimal project/package structure
- environment-based configuration
- health endpoint
- local development run command
- minimal dependency setup

Keep the implementation small and ready for the next Agent tickets.

## Service Responsibility

```text
request
→ LLM
→ tool decision
→ execute tool
→ LLM
→ final answer
```

Tools will later call:

```text
Knowledge tools → RAG Service
Business tools  → NestJS APIs
```

The Agent service must not access PostgreSQL or Qdrant directly.

T023 implements only the service foundation.

## Suggested Structure

```text
agent-service/
├── pyproject.toml
├── .env.example
└── src/
    └── agentcore/
        ├── __init__.py
        ├── main.py
        └── config.py
```

Do not create future modules before they are needed.

## API

### GET /health

Returns HTTP 200:

```json
{
  "status": "ok"
}
```

No authentication or NestJS integration is required in this ticket.

## Configuration
- Use environment variables.
- Add only variables required to run the service.
- Provide `.env.example` without secrets.
- Do not add LLM, RAG, NestJS, or tool configuration yet.

## Acceptance Criteria
- Standalone `agent-service` exists.
- FastAPI starts successfully.
- `GET /health` returns HTTP 200.
- Configuration is environment-based.
- `.env.example` contains no secrets.
- Dependencies are declared.
- Local run command is clear.
- Code is small and readable.

## Out of Scope
Do NOT implement:
- LLM client
- OpenAI integration
- Ollama integration
- agent loop
- tool calling
- tool registry
- tool schemas
- tool executors
- RAG integration
- NestJS integration
- conversation history logic
- PostgreSQL access
- Qdrant access
- authentication
- background jobs
- queues
- provider abstractions
- factories
- repositories
- unnecessary interfaces/base classes

## Implementation Rules
- Keep the service minimal.
- Do not over-engineer.
- Do not create abstractions for hypothetical future providers.
- Do not create classes when simple modules/functions are enough.
- Do not create one-use helpers when inline code is clearer.
- Follow existing repository conventions.
- Add only dependencies required by T023.

## Validation
1. Start the Agent service.
2. Call `GET /health`.
3. Confirm HTTP 200 and expected response.
4. Run relevant lint/type/test checks if configured.

## Completion Report
Report:
1. Files created.
2. Files modified.
3. Dependencies added.
4. What was implemented.
5. Validation results.
6. Any deviation from this ticket and why.
