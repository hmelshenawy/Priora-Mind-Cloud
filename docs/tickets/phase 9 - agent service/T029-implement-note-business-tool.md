# T029 — Implement Note Business Tool

## Phase
Phase 9 — Agent Service

## Goal
Add the second NestJS business tool to the Agent service:

```text
createNote
```

Reuse the business-tool pattern already proven by `createTask`.

## Current Proven Flow

```text
Client
→ NestJS
→ Agent
→ LLM
→ business tool
→ Agent calls NestJS with same access token
→ NestJS validates authentication/ownership
→ Service
→ PostgreSQL
→ result
→ Agent
→ LLM
→ final answer
```

## Scope

Implement one new Agent tool:

```text
createNote
```

The tool should:
- accept the note fields required by the existing NestJS Notes API
- use the access token already available in the Agent execution context
- call the real NestJS Notes endpoint
- return a small useful result to the Agent loop
- fail clearly if NestJS rejects the request

Do not add other note tools in this ticket.

## Tool Organization

Keep the current domain-based tool structure.

```text
agentcore/
└── tools/
    ├── tasks.py
    ├── notes.py
    ├── registry.py
    └── ...
```

`notes.py` owns note-related tool functions.

Use the existing registry pattern:

```python
registered_tools.append(createNote)
tools_map[createNote.__name__] = createNote
```

Do not introduce a new registry abstraction.

## Authentication

The access token does not come from the LLM.

The Agent receives the user access token from NestJS as request context.

When `createNote` executes:

```text
Agent
→ NestJS Notes API
Authorization: Bearer <same user access token>
```

NestJS remains responsible for:

```text
authentication
ownership
business validation
database access
```

## Tool Arguments

Use the actual fields supported by the existing NestJS Notes DTO/API.

Do not invent fields.

Conceptually:

```python
def createNote(
    mindSpaceId: str,
    title: str,
    content: str,
):
    ...
```

Adjust names only to match the real backend contract.

## HTTP Request

Reuse the same direct HTTP approach already used by `createTask`.

Conceptually:

```python
response = requests.post(
    url=...,
    json={
        ...
    },
    headers={
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    },
)
```

Do not build a generic backend client.

## Tool Result

Return only useful data.

Example intent:

```text
Note created successfully.
Note ID: ...
Title: ...
```

Do not expose:
- access token
- internal stack trace
- unnecessary backend metadata

## Agent Behavior

Example:

```text
User:
"Create a note titled Agent Ideas with content about tool routing"

LLM:
→ createNote(...)

Agent:
→ NestJS Notes API

NestJS:
→ validates token
→ validates ownership
→ creates note

Agent:
→ gives result back to LLM

LLM:
→ final confirmation
```

## Acceptance Criteria

- `createNote` exists in `tools/notes.py`.
- It uses the existing backend base URL configuration.
- It uses the access token from Agent execution context.
- The LLM does not provide or invent the token.
- It calls the real NestJS Notes endpoint.
- The request body matches the existing Notes DTO.
- NestJS performs authentication and ownership checks.
- A valid request creates a real note.
- The tool is registered in `registered_tools`.
- The tool is registered in `tools_map`.
- The Agent loop can execute it.
- The LLM can produce a final confirmation.
- Existing tools continue to work.
- No direct PostgreSQL access is added.

## Out of Scope

Do NOT implement:
- getNotes
- updateNote
- deleteNote
- task changes
- document tools
- new permission system
- roles
- shared notes
- generic backend SDK
- service-to-service auth redesign
- tool deduplication
- planner
- persistent conversation history changes
- automations

## Validation

### Case 1 — Create note

```text
Create a note titled "Agent Ideas" with content "Improve tool routing"
```

Expected:

```text
User
→ NestJS
→ Agent
→ createNote
→ NestJS Notes API
→ PostgreSQL
→ note created
→ LLM
→ final confirmation
```

### Case 2 — Invalid token

```text
NestJS rejects request
→ no note created
→ Agent handles failure gracefully
```

### Case 3 — Invalid MindSpace ownership

```text
NestJS ownership check fails
→ operation rejected
```

### Case 4 — Backend unavailable

```text
Agent does not crash
→ tool returns clear failure
→ LLM responds gracefully
```

## Completion Report

Report:
1. Files modified.
2. Note tool implemented.
3. NestJS endpoint called.
4. Request body used.
5. How access token is forwarded.
6. Registration method.
7. Validation results.
8. Any deviation from the ticket and why.
