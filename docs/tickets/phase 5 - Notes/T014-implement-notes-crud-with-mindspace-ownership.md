# T014 — Implement Notes CRUD with MindSpace Ownership

## Goal

Implement Notes CRUD in the NestJS backend.

A Note belongs to one MindSpace:

```text
User
 └── MindSpace
      └── Note
```

Notes are normal user-managed content in V1. This ticket does not include RAG ingestion, AI processing, or agent behavior.

## Phase

Phase 05 — Notes

## Dependencies

- T001–T013 completed.
- JWT authentication works.
- MindSpaces CRUD and ownership protection work.
- Prisma `Note` model already exists.

## Prisma Model

The existing model is conceptually:

```prisma
model Note {
  id          String   @id @default(uuid())
  mindSpaceId String
  title       String
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  mindSpace MindSpace @relation(
    fields: [mindSpaceId],
    references: [id],
    onDelete: Cascade
  )

  @@index([mindSpaceId])
}
```

Do not add `userId` to Note.

Ownership is derived through:

```text
Note → MindSpace → User
```

## Module Structure

Create:

```text
src/notes/
├── notes.module.ts
├── notes.controller.ts
├── notes.service.ts
└── dto/
    ├── create-note.dto.ts
    └── update-note.dto.ts
```

Keep the implementation direct. No repository or generic CRUD abstraction.

## API Design

```http
POST   /api/v1/notes
GET    /api/v1/notes?mindSpaceId=<uuid>
GET    /api/v1/notes/:id
PATCH  /api/v1/notes/:id
DELETE /api/v1/notes/:id
```

Use:

```text
Body       → create/update data
Query      → filter notes by MindSpace
Path param → identify one Note
JWT        → identify current user
```

Do not put `mindSpaceId` in a custom HTTP header.

---

## 1. Create Note

### Endpoint

```http
POST /api/v1/notes
```

### Body

```json
{
  "mindSpaceId": "uuid",
  "title": "RAG Ideas",
  "content": "Store document chunks with useful metadata."
}
```

### CreateNoteDto

Validate:

```text
mindSpaceId
- required
- UUID

title
- required
- string
- not empty

content
- required
- string
- not empty
```

The client must not send:

```text
userId
id
createdAt
updatedAt
```

### Flow

```text
Request
↓
JwtGuard
↓
req.user.userId
↓
CreateNoteDto
↓
verify MindSpace ownership
↓
create Note
↓
return Note
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

Then create:

```ts
prisma.note.create({
  data: {
    mindSpaceId: dto.mindSpaceId,
    title: dto.title.trim(),
    content: dto.content.trim(),
  },
});
```

---

## 2. List Notes

### Endpoint

```http
GET /api/v1/notes?mindSpaceId=<uuid>
```

For V1, `mindSpaceId` is required.

First verify:

```text
MindSpace.id = mindSpaceId
AND
MindSpace.userId = current user
```

If not found/not owned:

```text
404 Not Found
```

Then:

```ts
prisma.note.findMany({
  where: {
    mindSpaceId,
  },
  orderBy: {
    updatedAt: 'desc',
  },
});
```

Only return notes from the requested owned MindSpace.

---

## 3. Get One Note

### Endpoint

```http
GET /api/v1/notes/:id
```

Verify ownership through the relation:

```text
Note.id = requested id
AND
Note.mindSpace.userId = current user
```

Conceptually:

```ts
prisma.note.findFirst({
  where: {
    id,
    mindSpace: {
      userId,
    },
  },
});
```

If the Note does not exist or belongs to another user:

```text
404 Not Found
```

---

## 4. Update Note

### Endpoint

```http
PATCH /api/v1/notes/:id
```

### Example Body

```json
{
  "title": "Updated RAG Ideas",
  "content": "Updated content."
}
```

`UpdateNoteDto` should make the editable fields optional.

Editable:

```text
title
content
```

Do not allow changing:

```text
mindSpaceId
userId
id
createdAt
updatedAt
```

This ticket does not support moving a Note between MindSpaces.

Before updating verify:

```text
Note.id = requested id
AND
Note.mindSpace.userId = current user
```

If not found/not owned:

```text
404 Not Found
```

Then update only the supplied fields.

---

## 5. Delete Note

### Endpoint

```http
DELETE /api/v1/notes/:id
```

Verify ownership:

```text
Note → MindSpace → current user
```

If not found/not owned:

```text
404 Not Found
```

Then delete the Note.

Returning the deleted Note is acceptable:

```ts
return prisma.note.delete({
  where: { id },
});
```

---

## Controller Responsibility

Use:

```ts
@Controller('notes')
@UseGuards(JwtGuard)
export class NotesController {}
```

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

The controller should:

```text
read req.user.userId
read body/query/path
call NotesService
return result
```

Do not put Prisma queries or ownership business logic in the controller.

For listing, prefer:

```ts
@Query('mindSpaceId') mindSpaceId: string
```

instead of reading an untyped whole query object when only one query parameter is needed.

---

## Service Responsibility

Suggested methods:

```ts
create(dto, userId)
findAll(mindSpaceId, userId)
findOne(noteId, userId)
update(noteId, dto, userId)
remove(noteId, userId)
```

The service owns:

```text
MindSpace ownership checks
Note ownership checks
Prisma CRUD operations
```

Keep it simple.

Do not create:

```text
NotesRepository
OwnershipService
NotesManager
BaseCrudService
```

---

## Module

Conceptually:

```ts
@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
```

Register `NotesModule` in the application module as required by the current project structure.

---

## Manual Tests

Use User A and User B.

### Create

User A creates a Note inside User A's MindSpace.

Expected:

```text
201 Created
```

### List

```http
GET /notes?mindSpaceId=<user-a-mindspace-id>
```

Expected:

```text
200 OK
only notes from that MindSpace
```

### Read

User A reads own Note.

Expected:

```text
200 OK
```

### Update

User A updates own Note.

Expected:

```text
200 OK
```

### Delete

User A deletes own Note.

Expected:

```text
200 OK
```

### Cross-user Create

User B attempts to create a Note using User A's `mindSpaceId`.

Expected:

```text
404 Not Found
```

### Cross-user List

User B requests:

```http
GET /notes?mindSpaceId=<user-a-mindspace-id>
```

Expected:

```text
404 Not Found
```

### Cross-user Read/Update/Delete

User B uses User A's Note ID.

Expected:

```text
404 Not Found
```

---

## Implementation Principles

- Note belongs to MindSpace.
- Ownership is resolved through MindSpace.
- Do not add redundant `userId` to Note.
- `mindSpaceId` comes from create body.
- `mindSpaceId` is a query parameter for listing.
- Note ID is a path parameter for individual operations.
- Use the existing `JwtGuard`.
- Current authenticated ID is `req.user.userId`.
- Keep Prisma logic in NotesService.
- No repository abstraction.
- No generic ownership framework.
- No AI processing.
- No RAG ingestion.
- No embeddings.
- No agent tools.
- No unnecessary helper classes/functions.

## Acceptance Criteria

- `NotesModule` exists.
- `NotesController` exists.
- `NotesService` exists.
- Create/update DTOs use class-validator.
- All Notes routes require JWT authentication.
- `POST /notes` creates a Note only in an owned MindSpace.
- `GET /notes?mindSpaceId=...` returns notes only from an owned MindSpace.
- `GET /notes/:id` enforces ownership.
- `PATCH /notes/:id` enforces ownership.
- `DELETE /notes/:id` enforces ownership.
- Cross-user resource access returns 404.
- `userId` is never accepted from the client.
- Note does not contain redundant `userId`.
- Update does not allow changing `mindSpaceId`.
- TypeScript compiles successfully.
- NestJS starts successfully.
- No AI/RAG/Agent functionality is added.

## Out of Scope

- Note RAG ingestion
- Note embeddings
- Semantic search
- AI-generated notes
- Agent-created notes
- Note summarization
- Note version history
- Moving notes between MindSpaces
- Tags
- Search
- Pagination
- Soft delete
- Collaboration
- Automations
