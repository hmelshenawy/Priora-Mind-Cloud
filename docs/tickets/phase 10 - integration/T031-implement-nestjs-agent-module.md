# T031 — Implement NestJS Agent Module

## Phase
Phase 10 — Integration

## Goal
Add a small `AgentModule` to the NestJS backend so `ConversationService` can call the Python Agent Service through a dedicated `AgentService`.

NestJS remains responsible for conversation orchestration.

The Python Agent Service remains responsible for:

```text
LLM
tool selection
tool execution loop
RAG tool usage
business tool callbacks
final AI response
```

## Target Flow

```text
Client
→ ConversationController
→ ConversationService
→ AgentService
→ Python Agent Service
→ Agent / LLM / Tools
→ final answer
→ AgentService
→ ConversationService
→ save assistant message
→ Client
```

## Scope

Create a NestJS module:

```text
src/modules/agent/
├── agent.module.ts
├── agent.service.ts
├── dto/
│   └── run-agent.dto.ts
└── types/
    └── agent-response.type.ts
```

Keep it simple.

Do not add a controller unless one is clearly required.

The main caller is:

```text
ConversationService
```

## Responsibilities

### ConversationService

ConversationService owns:

```text
validate conversation
save user message
load conversation history
call AgentService
save assistant response
return result
```

ConversationService should not know:

```text
Python Agent URL details
HTTP request implementation
Agent transport details
```

### AgentService

AgentService owns only communication with the Python Agent Service.

Conceptually:

```ts
AgentService.runAgent(...)
```

Responsibilities:

```text
build Agent request
send HTTP request
pass user context
parse response
handle transport errors
return final Agent answer
```

AgentService must not contain:

```text
tool logic
RAG logic
business logic
conversation persistence
authorization decisions
```

## Configuration

Add environment configuration for the Python Agent Service.

Example:

```env
AGENT_SERVICE_URL=http://127.0.0.1:8900
AGENT_TIMEOUT_MS=120000
```

Use the project's existing configuration approach.

Do not hardcode the service URL inside ConversationService.

## Agent Request DTO

Create a request shape matching the current Python Agent API.

Target shape:

```ts
export class RunAgentDto {
  message: string;
  history: AgentHistoryItem[];
  accessToken: string;
}
```

The exact field names must match the real Python endpoint.

Do not invent extra fields.

## Conversation History

ConversationService should provide recent conversation history to AgentService.

Example conceptual shape:

```ts
[
  {
    role: 'user',
    content: '...'
  },
  {
    role: 'assistant',
    content: '...'
  }
]
```

Use the existing Message model and current conversation-history logic if already available.

Do not redesign conversation memory in this ticket.

## Access Token Flow

Replace the temporary Agent-side environment token pattern.

Current temporary pattern:

```text
Agent tool
→ Configs.ACCESS_TOKEN
```

Target pattern:

```text
Client
→ NestJS
Authorization: Bearer USER_TOKEN

NestJS validates USER_TOKEN

ConversationService
→ AgentService
→ Python Agent Service
    accessToken: USER_TOKEN

Python Agent
→ business tool
→ NestJS
Authorization: Bearer USER_TOKEN

NestJS validates USER_TOKEN again
```

Important:

```text
The LLM must never choose or generate the token.
```

The token is request context only.

Do not include the token in the LLM messages.

Do not log the token.

## Getting the Token in NestJS

Use the current authenticated request context.

Pass the original bearer token from the request into the conversation service path.

Do not replace authentication with plain `userId`.

The token is required because the Python Agent may call NestJS business APIs on behalf of the authenticated user.

## AgentService Example

Conceptually:

```ts
@Injectable()
export class AgentService {
  async runAgent(input: RunAgentInput): Promise<AgentResponse> {
    const response = await fetch(
      `${this.agentServiceUrl}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    );

    // validate response
    // handle errors
    // return final answer
  }
}
```

Follow the existing backend HTTP conventions if the project already has one.

Do not add a generic HTTP client abstraction only for this ticket.

## Python Agent Request

Update the Python Agent `/chat` request schema if needed so it can receive:

```json
{
  "message": "user message",
  "history": [],
  "accessToken": "..."
}
```

The Agent should use:

```text
message
history
```

for LLM context.

The Agent should use:

```text
accessToken
```

only for authenticated business-tool HTTP calls.

## Python Tool Context

Remove dependency on:

```python
Configs.ACCESS_TOKEN
```

for business tools.

The real access token must come from the current Agent request.

Keep the implementation simple.

Possible conceptual flow:

```text
POST /chat
→ read accessToken
→ Agent.run(...)
→ tool execution has access to request token
→ createTask / createNote / getAllTasks / getAllNotes
→ forward token to NestJS
```

Do not expose the token to the LLM tool schema.

The LLM should still see tool arguments such as:

```text
mindSpaceId
title
content
description
executor
```

but never:

```text
accessToken
userId
Authorization
```

## Response

The Python Agent should return a small stable response.

Example:

```json
{
  "response": "final assistant answer"
}
```

AgentService should extract and return the final answer to ConversationService.

## Error Handling

Handle at least:

```text
Agent service unavailable
Agent timeout
Agent returns non-2xx
Malformed Agent response
Empty Agent response
```

Map these into the project's existing error style.

Do not silently save an empty assistant message.

## Conversation Persistence

ConversationService should keep the existing order:

```text
1. validate conversation
2. save user message
3. load history
4. call AgentService
5. receive final Agent answer
6. save assistant message
7. return response
```

Do not move database ownership into AgentService.

## Acceptance Criteria

- `AgentModule` exists.
- `AgentService` exists.
- `ConversationService` injects `AgentService`.
- ConversationService does not call Python directly.
- AgentService calls the real Python Agent endpoint.
- Agent URL comes from configuration.
- Conversation history is sent to Agent.
- Original user access token is sent to Agent.
- Token is not included in LLM messages.
- Token is not exposed as a tool argument.
- Python business tools no longer depend on `Configs.ACCESS_TOKEN`.
- Python business tools forward the request-scoped token to NestJS.
- Existing tools continue to work.
- Agent final response is returned to ConversationService.
- ConversationService saves the assistant message.
- Empty Agent responses are not persisted.
- Agent failures are handled without crashing the NestJS process.
- No direct PostgreSQL access is added to Python Agent.

## Validation Cases

### Case 1 — Normal Chat

```text
Client
→ NestJS
→ ConversationService
→ AgentService
→ Python Agent
→ normal LLM answer
→ ConversationService saves assistant message
```

### Case 2 — Business Tool

```text
User:
"Create a task ..."

Client
→ NestJS
→ Agent
→ createTask
→ NestJS /tasks with same user token
→ task created
→ Agent final answer
→ ConversationService saves answer
```

### Case 3 — Recall Tool

```text
User:
"Show me all my notes"

NestJS
→ Agent
→ getAllNotes
→ NestJS /notes with same token
→ results
→ final answer
```

### Case 4 — RAG

```text
User asks knowledge question
→ Agent
→ searchKnowledge
→ RAG Service
→ result
→ final answer
```

### Case 5 — Invalid / Expired User Token

Expected:

```text
NestJS rejects original client request
```

or, if the token expires during the Agent callback:

```text
business tool callback rejected
→ Agent receives tool failure
→ final response explains operation failed
```

### Case 6 — Agent Service Down

Expected:

```text
ConversationService receives controlled AgentService error
→ no empty assistant message saved
→ request fails cleanly
```

### Case 7 — Agent Timeout

Expected:

```text
request aborted after configured timeout
→ controlled backend error
```

## Out of Scope

Do NOT implement:

```text
new tools
tool deduplication
planner
automations
new authorization model
generic service-to-service auth
refresh-token forwarding
conversation summarization
memory compression
streaming
WebSockets
queue-based Agent execution
retry framework
generic HTTP SDK
```

## Completion Report

When finished, report:

1. Files created.
2. Files modified.
3. AgentService request shape.
4. Python Agent request shape.
5. How conversation history is passed.
6. How access token is passed.
7. Where `Configs.ACCESS_TOKEN` was removed.
8. Agent endpoint used.
9. Timeout handling.
10. Conversation persistence flow.
11. Validation results.
12. Any deviation from this ticket and why.
