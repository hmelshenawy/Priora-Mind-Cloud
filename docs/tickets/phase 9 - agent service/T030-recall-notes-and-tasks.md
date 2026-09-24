# T030 — Recall Notes and Tasks

## Phase
Phase 9 — Agent Service

## Goal
Add read tools that let the Agent recall the user's existing Notes and Tasks from NestJS in one ticket.

The Agent must not query PostgreSQL directly.

## Target Flow

```text
User
→ NestJS
→ Agent
→ LLM decides it needs user data
→ getNotes / getTasks
→ NestJS APIs
→ PostgreSQL
→ tool results
→ LLM
→ final answer
```

## Scope

Implement two read-only business tools:

```text
getNotes
getTasks
```

The goal is to let the Agent retrieve the current user's stored Notes and Tasks when needed.

Examples:

```text
"What notes do I have?"
"Show me my tasks."
"What do I need to do?"
"Recall my notes and tasks."
```

For a request involving both domains, the Agent should be able to call both tools in the same agent loop.

## Tool Organization

Use the existing domain-based structure:

```text
agentcore/
└── tools/
    ├── notes.py
    ├── tasks.py
    ├── registry.py
    └── ...
```

Add `getNotes` to `notes.py`.

Add `getTasks` to `tasks.py`.

Keep the existing registration pattern:

```python
registered_tools.append(tool_schema)
tools_registery[function.__name__] = function
```

Do not introduce a new tool framework.

## Authentication

The access token must not come from the LLM.

Current target architecture:

```text
Client
→ NestJS validates user
→ NestJS sends request context to Agent
→ Agent forwards same access token when calling NestJS business APIs
```

For this ticket, follow the current project mechanism for obtaining the token.

Do not let the model generate:

```text
userId
accessToken
authorization headers
```

NestJS remains the security authority.

## getNotes

Implement a read-only tool that calls the existing NestJS Notes list endpoint.

Conceptually:

```python
def getNotes(...):
    response = requests.get(
        notes_url,
        headers={
            "Authorization": f"Bearer {accessToken}",
        },
    )
```

Use the actual existing Notes API contract.

If the Notes endpoint supports MindSpace filtering, expose/use the existing parameter only if required by the current backend contract.

Do not invent new backend API fields.

### Tool schema

Create a tool schema for `getNotes` containing only arguments actually needed by the endpoint.

Example if `mindSpaceId` is required:

```json
{
  "name": "getNotes",
  "parameters": {
    "type": "object",
    "properties": {
      "mindSpaceId": {
        "type": "string"
      }
    },
    "required": ["mindSpaceId"]
  }
}
```

If no argument is required by the API, use an empty parameters object.

## getTasks

Implement a read-only tool that calls the existing NestJS Tasks list endpoint.

Conceptually:

```python
def getTasks(...):
    response = requests.get(
        tasks_url,
        headers={
            "Authorization": f"Bearer {accessToken}",
        },
    )
```

Use the actual existing Tasks API contract.

If filters already exist, only expose the ones needed for this ticket.

Do not invent filtering behavior.

## Tool Results

Return structured useful data instead of wrapping everything as:

```python
{"response": response.text}
```

Preferred shape:

```python
{
    "success": True,
    "data": response.json(),
}
```

For failures:

```python
{
    "success": False,
    "status": response.status_code,
    "error": response.text,
}
```

Do not return the access token.

Do not return internal Python stack traces to the LLM.

## Multiple Tool Calls

The existing Agent loop already supports executing all tool calls returned by one model response.

Validate this case:

```text
User:
"Recall my notes and tasks."
```

Expected:

```text
LLM
├── getNotes(...)
└── getTasks(...)

Agent executes both
→ appends both tool results
→ LLM synthesizes one answer
```

Do not implement a special combined `getNotesAndTasks` function.

The Agent should compose the existing domain tools.

## Ownership and Security

The Agent must not decide which database records belong to the user.

NestJS must enforce:

```text
authentication
ownership
resource access
```

The tools simply call authenticated NestJS endpoints.

No direct database access from Agent.

## Error Handling

Handle at least:

```text
200 → return data
401 → authentication failure
403/404 → access/resource failure
5xx → backend failure
connection error → backend unavailable
timeout → backend timeout
```

The Agent process should not crash because one business tool failed.

If one tool succeeds and the other fails, preserve the successful result and let the LLM explain the partial result.

## Acceptance Criteria

- `getNotes` is implemented in `tools/notes.py`.
- `getTasks` is implemented in `tools/tasks.py`.
- Both call the real NestJS APIs.
- Both use authenticated requests.
- Neither accesses PostgreSQL directly.
- Both are registered in `registered_tools`.
- Both executable functions are registered in `tools_registery`.
- Schemas expose only necessary arguments.
- The LLM can call `getNotes` alone.
- The LLM can call `getTasks` alone.
- The LLM can call both for one user request.
- Tool results are structured as success/failure.
- Existing `createNote`, `createTask`, RAG, and common tools continue to work.
- No new generic API/client abstraction is introduced.

## Validation Cases

### Case 1 — Notes only

```text
User:
"Show me my notes."
```

Expected:

```text
LLM
→ getNotes
→ NestJS
→ notes returned
→ LLM summarizes/responds
```

### Case 2 — Tasks only

```text
User:
"What tasks do I have?"
```

Expected:

```text
LLM
→ getTasks
→ NestJS
→ tasks returned
→ LLM responds
```

### Case 3 — Recall both

```text
User:
"Recall all my notes and tasks."
```

Expected:

```text
LLM
→ getNotes
→ getTasks
→ both NestJS results
→ one final answer
```

### Case 4 — Empty data

If no notes/tasks exist:

```text
tool succeeds with empty list
→ LLM states that there are no stored items
```

### Case 5 — Invalid authentication

```text
NestJS rejects request
→ tool returns failure
→ Agent does not crash
```

### Case 6 — One tool fails

```text
getNotes ✅
getTasks ❌

→ successful notes remain available
→ LLM reports task retrieval failure without discarding notes
```

## Out of Scope

Do NOT implement:

- updateNote
- deleteNote
- updateTask
- deleteTask
- combined notes/tasks backend endpoint
- direct PostgreSQL queries
- pagination redesign
- new permissions system
- generic NestJS API SDK
- caching
- memory graph
- automations
- conversation-history integration
- token-context refactor beyond what is required to call the existing APIs

## Completion Report

When finished, report:

1. Files modified.
2. NestJS endpoints used.
3. Arguments exposed to each tool.
4. Tool schemas added.
5. Tool registration changes.
6. Response/error shape.
7. Results of notes-only test.
8. Results of tasks-only test.
9. Results of combined recall test.
10. Any deviation from this ticket and why.
