# T012 — Implement Conversations CRUD with MindSpace Ownership

## Goal

Implement Conversations as a simple authenticated resource.

A Conversation belongs to one MindSpace:

```text
User
 └── MindSpace
      └── Conversation
```

Use one `ConversationsController`.

Messages are not part of this ticket.

## Phase

Phase 04 — Conversations & Messages

## Dependencies

- T001–T011 completed.
- JWT authentication and `JwtGuard` work.
- MindSpaces CRUD and ownership protection work.
- Prisma `Conversation` model already exists.

## Module Structure

```text
src/conversations/
├── conversations.module.ts
├── conversations.controller.ts
├── conversations.service.ts
└── dto/
    ├── create-conversation.dto.ts
    └── update-conversation.dto.ts
```

Do not create a second controller or a separate MessagesModule.

## API Design

Use:

```http
POST   /api/v1/conversations
GET    /api/v1/conversations?mindSpaceId=<uuid>
GET    /api/v1/conversations/:id
PATCH  /api/v1/conversations/:id
DELETE /api/v1/conversations/:id
```

Why:

```text
Body       → data needed to create a resource
Query      → filtering/listing
Path param → identify one specific resource
Header     → authentication/request metadata
```

`mindSpaceId` is business/resource data, so do not put it in a custom HTTP header.

## Authentication

Protect the controller/routes with:

```ts
@UseGuards(JwtGuard)
```

Use the current request-user shape already established by `JwtStrategy`.

For the current project:

```ts
req.user.userId
```

is the authenticated user's ID.

Never accept `userId` from body/query/params.

---

## 1. Create Conversation

### Endpoint

```http
POST /api/v1/conversations
```

### Body

```json
{
  "mindSpaceId": "uuid",
  "title": "Project ideas"
}
```

### CreateConversationDto

Validate:

```text
mindSpaceId
- required
- string
- UUID

title
- required
- string
- not empty
```

### Flow

```text
Request
↓
JwtGuard
↓
req.user.userId
↓
CreateConversationDto
↓
verify MindSpace ownership
↓
create Conversation
```

Before creation verify:

```text
MindSpace.id = dto.mindSpaceId
AND
MindSpace.userId = current user
```

If the MindSpace does not exist or belongs to another user:

```text
404 Not Found
```

Then:

```ts
prisma.conversation.create({
  data: {
    title: dto.title,
    mindSpaceId: dto.mindSpaceId,
  },
});
```

Do not add `userId` to Conversation.

Ownership is derived through:

```text
Conversation → MindSpace → User
```

---

## 2. List Conversations

### Endpoint

```http
GET /api/v1/conversations?mindSpaceId=<uuid>
```

`mindSpaceId` is a query parameter because it filters the conversation collection.

### Flow

```text
Request
↓
JwtGuard
↓
mindSpaceId query
↓
verify MindSpace belongs to current user
↓
find conversations for that MindSpace
```

Conceptually:

```ts
prisma.conversation.findMany({
  where: {
    mindSpaceId,
  },
  orderBy: {
    updatedAt: 'desc',
  },
});
```

Do not return conversations from another user's MindSpace.

For V1, `mindSpaceId` should be required for this endpoint.

---

## 3. Get One Conversation

### Endpoint

```http
GET /api/v1/conversations/:id
```

Ownership must resolve through:

```text
Conversation
↓
MindSpace
↓
User
```

The requested conversation is accessible only when:

```text
conversation.id = requested ID
AND
conversation.mindSpace.userId = current user
```

If it does not exist or is owned by another user:

```text
404 Not Found
```

Do not expose whether another user's conversation exists.

---

## 4. Update Conversation

### Endpoint

```http
PATCH /api/v1/conversations/:id
```

### Body

```json
{
  "title": "Updated project ideas"
}
```

`UpdateConversationDto` should only allow the fields currently editable.

For V1:

```text
title
```

Do not allow:

```text
id
mindSpaceId
userId
createdAt
updatedAt
```

This ticket does not support moving a Conversation between MindSpaces.

Verify ownership before updating.

If not found or not owned:

```text
404 Not Found
```

---

## 5. Delete Conversation

### Endpoint

```http
DELETE /api/v1/conversations/:id
```

Verify:

```text
Conversation → MindSpace → current user
```

before deletion.

If not found or not owned:

```text
404 Not Found
```

Do not manually delete Messages if Prisma cascade behavior already handles the relation.

---

## Controller Responsibility

Use one controller:

```ts
@Controller('conversations')
@UseGuards(JwtGuard)
export class ConversationsController {}
```

Controller responsibilities:

```text
extract req.user.userId
read body/query/path
call ConversationsService
return result
```

No Prisma queries in the controller.

Conceptual methods:

```ts
@Post()
create(...)

@Get()
findAll(...)

@Get(':id')
findOne(...)

@Patch(':id')
update(...)

@Delete(':id')
remove(...)
```

---

## Service Responsibility

Suggested methods:

```ts
create(userId, dto)
findAll(userId, mindSpaceId)
findOne(userId, conversationId)
update(userId, conversationId, dto)
remove(userId, conversationId)
```

The service owns:

```text
MindSpace ownership checks
Conversation ownership checks
Prisma queries
CRUD behavior
```

Keep the implementation direct.

Do not create:

```text
ConversationRepository
OwnershipService
ConversationManager
BaseCrudService
```

for this ticket.

---

## Ownership Rules

### Create/List

Check:

```text
MindSpace.id = mindSpaceId
AND
MindSpace.userId = userId
```

### Get/Update/Delete

Check ownership through the relation:

```text
Conversation.id = conversationId
AND
Conversation.MindSpace.userId = userId
```

Do not add redundant `userId` to the Conversation model.

---

## Manual Validation

Use User A and User B.

User A creates a MindSpace and Conversation.

User B must not be able to:

```text
GET    /conversations/<user-a-conversation-id>
PATCH  /conversations/<user-a-conversation-id>
DELETE /conversations/<user-a-conversation-id>
```

Expected:

```text
404 Not Found
```

User B must not be able to create inside User A's MindSpace by sending its ID in the body.

Expected:

```text
404 Not Found
```

User B must not be able to list User A's conversations using:

```http
GET /conversations?mindSpaceId=<user-a-mindspace-id>
```

Expected:

```text
404 Not Found
```

---

## Implementation Principles

- One `ConversationsController`.
- Conversation belongs to MindSpace.
- `mindSpaceId` is in create body.
- `mindSpaceId` is a query parameter when listing.
- Conversation ID is a path parameter for individual operations.
- Do not put `mindSpaceId` in HTTP headers.
- Do not add `userId` to Conversation.
- Do not implement Messages yet.
- No AI or RAG calls.
- No auto-title generation.
- No pagination unless currently needed.
- No repository abstraction.
- No generic ownership framework.
- Use existing `JwtGuard`.
- Use existing `PrismaService`.
- Follow the project anti-overengineering rules.

## Acceptance Criteria

- `ConversationsModule` exists.
- One `ConversationsController` exists.
- `ConversationsService` exists.
- Create/update DTOs use class-validator.
- All Conversation routes require JWT authentication.
- `POST /conversations` accepts `mindSpaceId` and `title`.
- Create verifies MindSpace ownership.
- `GET /conversations?mindSpaceId=...` lists only conversations in an owned MindSpace.
- `GET /conversations/:id` enforces ownership.
- `PATCH /conversations/:id` enforces ownership.
- `DELETE /conversations/:id` enforces ownership.
- `mindSpaceId` is not passed through a custom header.
- `userId` comes only from authenticated `req.user`.
- Conversation does not contain redundant `userId`.
- Not-owned resources return `404`.
- Messages are not implemented in this ticket.
- TypeScript compiles with zero errors.
- NestJS starts successfully.

## Out of Scope

- Messages
- Sending chat messages
- LLM calls
- Agent service
- RAG
- Citations
- Conversation auto-title
- Archive
- Search
- Pagination
- Soft delete
- Automations
