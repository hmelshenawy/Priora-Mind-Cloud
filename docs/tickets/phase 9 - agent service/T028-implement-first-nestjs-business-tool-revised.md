# T028 — Implement First NestJS Business Tool (Revised)

## Phase
Phase 9 — Agent Service

## Goal
Connect the Agent service to the NestJS backend through one real business tool while preserving the existing security boundary.

## Correct Request Direction

Main request:

```text
Client
→ NestJS
→ Agent Service
```

If the Agent decides to execute a business action:

```text
Agent Service
→ NestJS
→ Business Service
→ PostgreSQL
```

The Agent is not an external entry point for business operations.

## Authentication Model

Priora MindCloud V1 is personal.

Authenticated users can use normal application capabilities, but only on data they own:

```text
User can operate only on their own data.
```

No separate permission list such as `task:create` or `note:create` is introduced in this ticket.

The existing user access token is the authorization context.

## Token Flow

Client request:

```text
Client
→ NestJS
Authorization: Bearer <USER_ACCESS_TOKEN>
```

NestJS validates the token, then sends the same access token to the Agent request context.

Conceptually:

```json
{
  "message": "Create a task called Review Priora architecture",
  "accessToken": "<USER_ACCESS_TOKEN>"
}
```

If the Agent chooses `createTask`, it forwards the same token back to NestJS:

```text
Agent
→ NestJS /tasks
Authorization: Bearer <USER_ACCESS_TOKEN>
```

NestJS validates the token again and applies existing ownership checks.

## First Business Tool

Implement only:

```text
createTask
```

Flow:

```text
User
→ NestJS
→ Agent
→ LLM decides createTask
→ Agent calls NestJS with same access token
→ NestJS validates user
→ Task Service
→ PostgreSQL
→ result
→ Agent
→ LLM
→ final answer
```

## Scope

Implement:
- access token received in Agent request context
- one `createTask` tool
- HTTP call from Agent to the existing NestJS Task endpoint
- forwarding of the same access token in the Authorization header
- reuse of the existing Agent loop
- reuse of `registered_tools` and `tools_map`
- graceful backend failure handling

Do not add multiple NestJS business tools.

## Configuration

Add:

```env
BACKEND_SERVICE_URL=http://127.0.0.1:<backend-port>
```

Use the actual existing NestJS port.

## Suggested Agent Request Shape

Conceptually:

```python
class AgentRequest(BaseModel):
    message: str
    accessToken: str
```

Do not persist the token.
Do not log the token.

## Tool Arguments vs Auth Context

The actual task fields must match the existing NestJS Task DTO/API.

Conceptually:

```python
def createTask(
    title: str,
    mind_space_id: str,
) -> str:
    ...
```

The LLM must NOT receive or invent the access token.

The access token comes from the trusted Agent request context and is injected by the Agent when executing the tool.

```text
LLM chooses:
createTask(title="Review Priora architecture", ...)

Agent already has:
accessToken

Agent adds:
Authorization: Bearer accessToken
```

## Security Rule

The LLM must never be responsible for:
- choosing the authenticated user
- choosing an access token
- granting authorization
- deciding ownership

NestJS remains the authority.

## Boundary

Correct:

```text
Client
→ NestJS
→ Agent
→ NestJS
→ Task Service
→ Prisma
→ PostgreSQL
```

Incorrect:

```text
Client
→ Agent directly for business actions

Agent
→ PostgreSQL directly

Agent
→ NestJS without authenticated user context
```

## Ownership

NestJS resolves the authenticated user from the access token and applies existing ownership checks.

```text
access token
→ authenticated userId
→ requested MindSpace/Task
→ ownership check
→ execute if owned
```

The Agent does not replace these checks.

## HTTP Client

Reuse the same simple HTTP approach already used for the RAG tool.

Do not introduce:
- generic backend SDK
- repository layer
- API adapter hierarchy
- retry framework
- service discovery

## Tool Result

Return a small useful result.

Example:

```text
Task created successfully.
Task ID: ...
Title: Review Priora architecture
```

Do not expose the access token.

## Acceptance Criteria

- `BACKEND_SERVICE_URL` is configurable.
- Agent request can receive the user's access token from NestJS.
- The access token is not logged or persisted.
- One `createTask` business tool exists.
- The tool is registered in `registered_tools`.
- The tool is registered in `tools_map`.
- The LLM does not receive or generate the access token as a tool argument.
- The Agent injects the access token when calling NestJS.
- The Agent sends `Authorization: Bearer <USER_ACCESS_TOKEN>`.
- NestJS validates the token again.
- Existing NestJS ownership checks remain responsible for data access.
- A successful call creates a real task through NestJS.
- The Agent never accesses PostgreSQL directly.
- Existing local tools and RAG search continue to work.
- No separate permission-list system is introduced.

## Out of Scope

Do NOT implement:
- role/permission matrix
- `task:create` style permission claims
- multiple business tools
- notes tool
- document tool
- shared-user collaboration
- admin roles
- replacement service-to-service JWT design
- refresh-token forwarding
- persistent conversation history changes
- memory
- automations
- queues
- generic SDK
- tool deduplication

## Validation

### Case 1 — Successful task creation

```text
Client
→ NestJS with valid access token
→ NestJS calls Agent with token context
→ Agent chooses createTask
→ Agent calls NestJS with same token
→ NestJS validates authentication/ownership
→ task created
```

### Case 2 — Invalid or expired token

```text
Agent business call
→ NestJS rejects request
→ no task created
→ Agent handles failure gracefully
```

### Case 3 — Resource not owned by user

```text
NestJS ownership check fails
→ operation rejected
```

### Case 4 — Backend unavailable

```text
Agent does not crash
→ tool reports backend failure clearly
→ LLM responds gracefully
```

## Completion Report

Report:
1. Files modified.
2. Configuration added.
3. Agent request changes.
4. How the access token is received.
5. How the token is forwarded to NestJS.
6. Business tool implemented.
7. NestJS endpoint called.
8. Validation results.
9. Any deviation from this ticket and why.
