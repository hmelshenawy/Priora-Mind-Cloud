# T015 — Implement Tasks CRUD with MindSpace Ownership

## Goal

Implement Tasks CRUD in the NestJS backend.

A Task belongs to one MindSpace:

```text
User
 └── MindSpace
      └── Task
```

V1 Tasks support a status and an executor, but this ticket does not implement Agent execution or automation.

## Phase

Phase 06 — Tasks

## Dependencies

- T001–T014 completed.
- JWT authentication works.
- MindSpaces ownership protection works.
- Prisma `Task` model and enums already exist.

## Existing Prisma Model

```prisma
model Task {
  id          String     @id @default(uuid())
  mindSpaceId String
  title       String
  description String?
  status      TaskStatus @default(PENDING)
  executor    Executor   @default(USER)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  mindSpace MindSpace @relation(
    fields: [mindSpaceId],
    references: [id],
    onDelete: Cascade
  )

  @@index([mindSpaceId])
}
```

Existing enums:

```prisma
enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum Executor {
  USER
  AGENT
}
```

Do not add `userId` to Task.

Ownership is:

```text
Task → MindSpace → User
```

---

## Module Structure

Create:

```text
src/tasks/
├── tasks.module.ts
├── tasks.controller.ts
├── tasks.service.ts
└── dto/
    ├── create-task.dto.ts
    └── update-task.dto.ts
```

No repository or generic CRUD abstraction.

---

## API Design

```http
POST   /api/v1/tasks
GET    /api/v1/tasks?mindSpaceId=<uuid>
GET    /api/v1/tasks/:id
PATCH  /api/v1/tasks/:id
DELETE /api/v1/tasks/:id
```

Use:

```text
Body       → create/update data
Query      → filter Tasks by MindSpace
Path param → identify one Task
JWT        → current user
```

---

# 1. Create Task

## Endpoint

```http
POST /api/v1/tasks
```

## Example Body

```json
{
  "mindSpaceId": "uuid",
  "title": "Review RAG architecture",
  "description": "Review the ingestion and retrieval flow.",
  "executor": "USER"
}
```

## CreateTaskDto

Validate:

```text
mindSpaceId
- required
- UUID

title
- required
- string
- not empty

description
- optional
- string

executor
- optional
- valid Executor enum
```

Do not accept `status` on creation for V1.

The Prisma default must create new Tasks as:

```text
PENDING
```

If `executor` is omitted, Prisma default should create:

```text
USER
```

Do not accept:

```text
userId
id
createdAt
updatedAt
```

## Ownership

Before creating:

```text
MindSpace.id = dto.mindSpaceId
AND
MindSpace.userId = current user
```

Not found/not owned:

```text
404 Not Found
```

Then create the Task.

---

# 2. List Tasks

## Endpoint

```http
GET /api/v1/tasks?mindSpaceId=<uuid>
```

For V1, `mindSpaceId` is required.

Use `ParseUUIDPipe` for the query parameter.

First verify:

```text
MindSpace.id = mindSpaceId
AND
MindSpace.userId = current user
```

Then:

```ts
prisma.task.findMany({
  where: { mindSpaceId },
  orderBy: { updatedAt: 'desc' },
});
```

No status/executor filtering is required in this ticket.

---

# 3. Get One Task

## Endpoint

```http
GET /api/v1/tasks/:id
```

Use `ParseUUIDPipe` for `:id`.

Verify:

```text
Task.id = id
AND
Task.mindSpace.userId = current user
```

Conceptually:

```ts
prisma.task.findFirst({
  where: {
    id,
    mindSpace: {
      userId,
    },
  },
});
```

Not found/not owned:

```text
404 Not Found
```

---

# 4. Update Task

## Endpoint

```http
PATCH /api/v1/tasks/:id
```

Use `ParseUUIDPipe` for `:id`.

Editable fields:

```text
title
description
status
executor
```

Example:

```json
{
  "status": "IN_PROGRESS"
}
```

or:

```json
{
  "title": "Review updated RAG architecture",
  "executor": "AGENT"
}
```

## UpdateTaskDto

All editable fields are optional.

Validate `status` against `TaskStatus`.

Validate `executor` against `Executor`.

Do not allow changing:

```text
mindSpaceId
userId
id
createdAt
updatedAt
```

This ticket does not support moving Tasks between MindSpaces.

Before update, verify Task ownership.

---

# 5. Delete Task

## Endpoint

```http
DELETE /api/v1/tasks/:id
```

Use `ParseUUIDPipe` for `:id`.

Verify:

```text
Task → MindSpace → current user
```

before deletion.

Not found/not owned:

```text
404 Not Found
```

Then delete and return the deleted Task.

---

## Controller

Use:

```ts
@Controller('tasks')
@UseGuards(JwtGuard)
export class TasksController {}
```

Methods:

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

Use the established request shape:

```ts
@Req() req: { user: { userId: string } }
```

Prefer:

```ts
@Query('mindSpaceId', ParseUUIDPipe)
```

and:

```ts
@Param('id', ParseUUIDPipe)
```

Keep Prisma/business logic out of the controller.

---

## Service

Suggested methods:

```ts
create(dto, userId)
findAll(mindSpaceId, userId)
findOne(taskId, userId)
update(taskId, dto, userId)
remove(taskId, userId)
```

For update/remove, reusing `findOne()` for the ownership check is acceptable and simple.

The service owns:

```text
MindSpace ownership checks
Task ownership checks
Prisma CRUD
```

---

## Module

Conceptually:

```ts
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
```

Register `TasksModule` in the application module.

---

# Important Executor Rule

`executor = AGENT` currently means only:

```text
this Task is intended to be executed by the Agent
```

It does NOT trigger anything.

For Phase 6:

```text
executor = AGENT
↓
stored in PostgreSQL
↓
nothing automatically executes
```

Actual Agent execution belongs to later Agent/Integration phases.

Do not add:

```text
Agent calls
background jobs
schedulers
queues
automation triggers
```

---

## Manual Tests

### User A — Create

Create a Task in User A's MindSpace.

Expected:

```text
201 Created
status = PENDING
executor = USER (when omitted)
```

### Explicit Executor

Create with:

```json
{
  "mindSpaceId": "uuid",
  "title": "Research topic",
  "executor": "AGENT"
}
```

Expected:

```text
201 Created
executor = AGENT
```

No Agent should run.

### List

```http
GET /tasks?mindSpaceId=<owned-mindspace-id>
```

Expected:

```text
200 OK
```

### Update Status

```json
{
  "status": "COMPLETED"
}
```

Expected:

```text
200 OK
status = COMPLETED
```

### Invalid Status

```json
{
  "status": "DONE"
}
```

Expected:

```text
400 Bad Request
```

### Cross-user Access

User B attempts create/list/get/update/delete using User A's MindSpace or Task IDs.

Expected:

```text
404 Not Found
```

---

## Implementation Principles

- Task belongs to MindSpace.
- Do not add redundant `userId`.
- Ownership resolves through MindSpace.
- Use existing JwtGuard.
- Current authenticated ID is `req.user.userId`.
- New Tasks start as `PENDING`.
- Default executor is `USER`.
- `AGENT` is only stored metadata in this phase.
- No Agent execution.
- No automation.
- No queue.
- No scheduler.
- No repository abstraction.
- No generic ownership framework.
- Keep implementation consistent with Notes and Conversations.

---

## Acceptance Criteria

- `TasksModule` exists.
- `TasksController` exists.
- `TasksService` exists.
- Create/update DTOs use class-validator.
- All routes require JWT.
- Create verifies MindSpace ownership.
- List verifies MindSpace ownership.
- Get/update/delete verify Task ownership through MindSpace.
- Non-owned resources return 404.
- IDs use UUID validation at the controller boundary.
- New Task defaults to `PENDING`.
- Executor defaults to `USER` when omitted.
- Valid `TaskStatus` values are accepted.
- Invalid status is rejected.
- Valid `Executor` values are accepted.
- Invalid executor is rejected.
- Client cannot change `mindSpaceId` during update.
- No redundant `userId` is added to Task.
- No Agent/automation behavior is implemented.
- TypeScript compiles successfully.
- NestJS starts successfully.

## Out of Scope

- Agent task execution
- Scheduled Tasks
- Due dates
- Recurring Tasks
- Priorities
- Task dependencies
- Notifications
- Queues/workers
- Automations
- RAG
- AI planning
- Semantic search
- Pagination
- Soft delete
