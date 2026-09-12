# T011 — Implement MindSpaces CRUD with Ownership Protection

## Goal

Implement the first real business feature after authentication: user-owned MindSpaces.

A MindSpace is a top-level container owned by one authenticated user.

Examples:

```text
Work
Personal
Learning
Islamic
```

Later, conversations, notes, tasks, and documents will belong to a MindSpace.

## Phase

Phase 03 — MindSpaces

## Dependencies

- T001–T010 completed.
- JWT login works.
- `JwtStrategy` works.
- `JwtGuard` works.
- Authenticated requests expose:

```ts
req.user = {
  id: string,
  email: string,
}
```

- Prisma `MindSpace` model already exists.

## Module Structure

Create:

```text
src/mindspaces/
├── mindspaces.module.ts
├── mindspaces.controller.ts
├── mindspaces.service.ts
└── dto/
    ├── create-mindspace.dto.ts
    └── update-mindspace.dto.ts
```

Keep the module simple.

## Authentication

All MindSpace endpoints must require authentication.

Use:

```ts
@UseGuards(JwtGuard)
```

The authenticated user's ID must come from:

```ts
req.user.id
```

Never accept `userId` from the request body.

## API Endpoints

Implement:

```http
POST   /api/v1/mindspaces
GET    /api/v1/mindspaces
GET    /api/v1/mindspaces/:id
PATCH  /api/v1/mindspaces/:id
DELETE /api/v1/mindspaces/:id
```

All routes are protected.

## 1. Create MindSpace

Body:

```json
{
  "name": "Work"
}
```

Create DTO validation:

```text
name
- required
- string
- not empty
```

Flow:

```text
request
↓
JwtGuard
↓
req.user.id
↓
CreateMindSpaceDto
↓
MindSpacesService.create()
↓
Prisma
```

Conceptually:

```ts
prisma.mindSpace.create({
  data: {
    name: dto.name,
    userId,
  },
});
```

## 2. List Current User MindSpaces

Return only MindSpaces owned by the authenticated user.

Conceptually:

```ts
prisma.mindSpace.findMany({
  where: {
    userId,
  },
});
```

Recommended ordering:

```text
createdAt descending
```

## 3. Get One MindSpace

Ownership must be enforced.

Use both:

```text
id
userId
```

If the MindSpace does not exist OR belongs to another user:

```text
404 Not Found
```

Do not reveal whether another user's MindSpace exists.

## 4. Update MindSpace

Only allow:

```text
name
```

Do not allow:

```text
userId
id
createdAt
updatedAt
```

Verify ownership before update.

If not found / not owned:

```text
404 Not Found
```

## 5. Delete MindSpace

Only the owner can delete it.

If not found / not owned:

```text
404 Not Found
```

## Ownership Rule

This is the most important rule in this ticket:

```text
Every MindSpace operation must be scoped to the authenticated user.
```

Think:

```text
resource identity
+
current user identity
=
allowed operation
```

User A must never access User B's MindSpace even if User A knows its UUID.

## Controller Responsibility

Controller should:

```text
receive request
extract req.user.id
receive DTO / route params
call service
return response
```

Do not put Prisma queries in the controller.

## Service Responsibility

Service should own:

```text
create
findAll
findOne
update
remove
ownership checks
Prisma access
```

Suggested methods:

```ts
create(userId, dto)
findAll(userId)
findOne(userId, mindSpaceId)
update(userId, mindSpaceId, dto)
remove(userId, mindSpaceId)
```

## Error Behavior

Missing/invalid JWT:

```text
401 Unauthorized
```

Not found or not owned:

```text
404 Not Found
```

## Manual Validation

Use two users.

User A creates:

```text
Work
Personal
```

User B creates:

```text
Learning
```

Expected:

```text
GET /mindspaces
```

returns only the current user's spaces.

Then take User A's MindSpace ID and call as User B:

```text
GET /mindspaces/<user-a-id>
PATCH /mindspaces/<user-a-id>
DELETE /mindspaces/<user-a-id>
```

Expected:

```text
404
```

## Implementation Principles

- Keep MindSpaces flat in V1.
- No nested MindSpaces.
- No sharing/collaboration.
- No roles/permissions system.
- No repository abstraction.
- No generic CRUD base service.
- No event system.
- No caching.
- No pagination unless currently needed.
- No soft delete.
- No AI logic in MindSpaces.
- Use existing `JwtGuard`.
- Use existing `PrismaService`.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Acceptance Criteria

- `MindSpacesModule` exists.
- `MindSpacesController` exists.
- `MindSpacesService` exists.
- Create/update DTOs use class-validator.
- All routes require `JwtGuard`.
- `POST /mindspaces` creates a MindSpace for `req.user.id`.
- `userId` is never taken from request body.
- `GET /mindspaces` returns only current user's MindSpaces.
- `GET /mindspaces/:id` enforces ownership.
- `PATCH /mindspaces/:id` enforces ownership.
- `DELETE /mindspaces/:id` enforces ownership.
- Other users cannot access a MindSpace by UUID.
- Not-owned resources return `404`.
- Prisma queries stay in the service.
- TypeScript compiles with zero errors.
- NestJS starts successfully.

## Out of Scope

- Conversations
- Messages
- Notes
- Tasks
- Documents
- RAG
- Agent logic
- Nested MindSpaces
- MindSpace sharing
- Collaboration
- Search
- Pagination
- Soft delete
- Automations
