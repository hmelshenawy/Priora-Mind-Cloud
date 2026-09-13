# T013 — Implement Conversation Messages

## Goal

Implement message persistence and retrieval inside the existing `ConversationsModule`.

```text
User
 └── MindSpace
      └── Conversation
           └── Message
```

This ticket is only for storing and reading messages.

Do not integrate Agent, LLM, or RAG yet.

## Phase

Phase 04 — Conversations & Messages

## Dependencies

- T001–T012 completed.
- JWT authentication works.
- MindSpace ownership protection works.
- Conversations CRUD works.
- Prisma `Message` model already exists.

## Module Structure

```text
src/conversations/
├── conversations.module.ts
├── conversations.controller.ts
├── conversations.service.ts
├── conversation-messages.service.ts
└── dto/
    ├── create-conversation.dto.ts
    ├── update-conversation.dto.ts
    └── create-message.dto.ts
```

Do not create a separate `MessagesModule` or `MessagesController`.

## API Design

```http
POST /api/v1/conversations/:id/messages
GET  /api/v1/conversations/:id/messages
```

`:id` is the Conversation ID.

## Create Message

### Endpoint

```http
POST /api/v1/conversations/:id/messages
```

### Body

```json
{
  "content": "I want to organize my project ideas."
}
```

The client must not send:

```text
role
conversationId
userId
mindSpaceId
```

For this ticket the backend always creates a `USER` message.

### CreateMessageDto

```ts
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
```

### Flow

```text
JwtGuard
↓
req.user.userId
↓
conversationId from path
↓
validate DTO
↓
verify Conversation ownership
↓
create USER message
↓
return message
```

### Ownership Check

Verify:

```text
Conversation.id = conversationId
AND
Conversation.mindSpace.userId = current user
```

Conceptually:

```ts
const conversation = await prisma.conversation.findFirst({
  where: {
    id: conversationId,
    mindSpace: {
      userId,
    },
  },
});
```

If not found or not owned:

```text
404 Not Found
```

### Save Message

```ts
return prisma.message.create({
  data: {
    conversationId,
    role: MessageRole.USER,
    content: dto.content.trim(),
  },
});
```

## List Messages

### Endpoint

```http
GET /api/v1/conversations/:id/messages
```

Verify Conversation ownership first, then:

```ts
return prisma.message.findMany({
  where: {
    conversationId,
  },
  orderBy: {
    createdAt: 'asc',
  },
});
```

Return oldest → newest.

## Controller Changes

Keep the existing controller:

```ts
@Controller('conversations')
@UseGuards(JwtGuard)
export class ConversationsController {}
```

Add:

```ts
@Post(':id/messages')
createMessage(
  @Param('id') conversationId: string,
  @Body() dto: CreateMessageDto,
  @Req() req: any,
) {
  return this.conversationMessagesService.create(
    conversationId,
    dto,
    req.user.userId,
  );
}
```

and:

```ts
@Get(':id/messages')
findMessages(
  @Param('id') conversationId: string,
  @Req() req: any,
) {
  return this.conversationMessagesService.findAll(
    conversationId,
    req.user.userId,
  );
}
```

## ConversationMessagesService

Create:

```text
conversation-messages.service.ts
```

Suggested methods:

```ts
create(conversationId, dto, userId)
findAll(conversationId, userId)
```

Responsibilities:

```text
verify Conversation ownership
store user message
load conversation messages
```

## conversations.module.ts

Register:

```ts
providers: [
  ConversationsService,
  ConversationMessagesService,
]
```

No new module.

## Important Scope Rule

For now:

```text
POST /conversations/:id/messages
```

means:

```text
save user message
```

NOT:

```text
save message
→ Agent
→ LLM
→ RAG
→ assistant reply
```

AI integration belongs later in Phase 9/10.

## Manual Tests

### User A creates a message in own Conversation

Expected:

```text
201 Created
role = USER
```

### User A lists messages

Expected:

```text
200 OK
oldest → newest
```

### User B tries to create/read messages in User A's Conversation

Expected:

```text
404 Not Found
```

### Client sends role

```json
{
  "content": "Hello",
  "role": "ASSISTANT"
}
```

With the existing global validation:

```ts
whitelist: true
forbidNonWhitelisted: true
```

Expected:

```text
400 Bad Request
```

## Implementation Principles

- Keep Messages inside `ConversationsModule`.
- Use one `ConversationsController`.
- Add one `ConversationMessagesService`.
- Ownership is derived through Conversation → MindSpace → User.
- Do not add `userId` or `mindSpaceId` to Message.
- Client sends only content.
- Backend sets `role = USER`.
- Verify ownership before create/read.
- Return 404 for non-owned Conversation.
- No AI, Agent, RAG, streaming, citations, repositories, or generic ownership abstractions.

## Acceptance Criteria

- `CreateMessageDto` exists.
- `ConversationMessagesService` exists.
- Service is registered in `ConversationsModule`.
- Existing controller exposes both message endpoints.
- Both endpoints require JWT.
- User can create/read messages only in owned Conversations.
- Backend sets role to `USER`.
- Client cannot set role.
- Messages return oldest to newest.
- Non-owned/not-found Conversation returns 404.
- No redundant ownership columns are added.
- No Agent/LLM/RAG code is added.
- TypeScript compiles.
- NestJS starts successfully.

## Out of Scope

- Assistant AI messages
- Agent tool calling
- RAG retrieval
- Citations
- Streaming
- Retry/idempotency
- Message update/delete
- Pagination
- Automations
