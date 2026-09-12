# T005 — Define Core Prisma Models and Create Initial Migration

## Goal

Define the V1 relational data model for Priora MindCloud in Prisma and create the first PostgreSQL migration.

## Phase

Phase 01 — NestJS Foundation

## Dependencies

- T001 — Initialize NestJS Backend
- T002 — Configure Environment and Application Bootstrap
- T003 — Configure Global Request Validation
- T004 — Configure PostgreSQL and Prisma

## Scope

Create the core Prisma models required by the approved V1 data model.

This ticket defines database structure only.

Do not implement feature modules, services, controllers, authentication logic, or CRUD behavior yet.

## Models

Create the following Prisma models:

```text
User
MindSpace
Conversation
Message
Note
Task
Document
```

## Required Relationships

```text
User
 └── MindSpaces
      ├── Conversations
      │    └── Messages
      ├── Notes
      ├── Tasks
      └── Documents
```

Relationship rules:

```text
MindSpace many-to-one User

Conversation many-to-one User
Conversation many-to-one MindSpace

Message many-to-one User
Message many-to-one Conversation

Note many-to-one User
Note many-to-one MindSpace

Task many-to-one User
Task many-to-one MindSpace

Document many-to-one User
Document many-to-one MindSpace
```

## Required Fields

### User

```text
id
email
passwordHash
createdAt
updatedAt
```

Requirements:

- `id` should use UUID.
- `email` must be unique.

### MindSpace

```text
id
userId
name
createdAt
updatedAt
```

### Conversation

```text
id
userId
mindSpaceId
title
createdAt
updatedAt
```

### Message

```text
id
userId
conversationId
role
content
createdAt
```

### Note

```text
id
userId
mindSpaceId
title
content
createdAt
updatedAt
```

### Task

```text
id
userId
mindSpaceId
title
description
status
executor
createdAt
updatedAt
```

### Document

```text
id
userId
mindSpaceId
fileName
storageKey
status
createdAt
updatedAt
```

## Enums

Create only the enums currently required by V1.

### MessageRole

```text
USER
ASSISTANT
```

### TaskStatus

```text
PENDING
IN_PROGRESS
DONE
CANCELLED
```

### TaskExecutor

```text
USER
AGENT
```

`AGENT` is stored for future execution support, but automation remains outside V1.

### DocumentStatus

```text
PROCESSING
READY
FAILED
```

## Foreign Keys

All ownership and parent relationships must use actual foreign-key relations.

Examples:

```text
MindSpace.userId → User.id
Conversation.userId → User.id
Conversation.mindSpaceId → MindSpace.id
Message.userId → User.id
Message.conversationId → Conversation.id
Note.userId → User.id
Note.mindSpaceId → MindSpace.id
Task.userId → User.id
Task.mindSpaceId → MindSpace.id
Document.userId → User.id
Document.mindSpaceId → MindSpace.id
```

## Indexes

Add only indexes with an obvious current query/ownership use.

Recommended indexes:

```text
MindSpace.userId

Conversation.userId
Conversation.mindSpaceId

Message.userId
Message.conversationId
Message.createdAt

Note.userId
Note.mindSpaceId

Task.userId
Task.mindSpaceId
Task.status

Document.userId
Document.mindSpaceId
Document.status
```

Do not add speculative indexes.

## Referential Behavior

Preferred V1 behavior:

```text
User deleted
→ owned MindSpaces and directly owned records are deleted

MindSpace deleted
→ Conversations, Notes, Tasks, Documents in that MindSpace are deleted

Conversation deleted
→ Messages in that Conversation are deleted
```

Use Prisma relation actions where appropriate.

Do not introduce soft-delete fields in this ticket.

## Migration

After defining the schema:

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name init_core_schema
npx prisma generate
```

## Implementation Principles

- Keep the Prisma schema simple.
- Model only approved V1 requirements.
- Do not create extra tables for hypothetical future features.
- Do not create repository interfaces.
- Do not create domain entity classes duplicating Prisma models.
- Do not create mapping layers between Prisma models and identical application shapes.
- Do not add soft-delete infrastructure.
- Do not add audit-log tables.
- Do not add nested MindSpaces.
- Do not add automation models.
- Do not add vector/chunk tables to PostgreSQL.
- RAG chunks and embeddings belong in the Vector DB.
- Original files belong in Object Storage.
- PostgreSQL stores structured application data.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Acceptance Criteria

- All seven core models exist in `schema.prisma`.
- Required enums exist.
- All required foreign-key relations are defined.
- Required ownership fields are present.
- UUID IDs are used.
- `User.email` is unique.
- Required timestamps are present.
- Only justified indexes are added.
- `npx prisma format` succeeds.
- `npx prisma validate` succeeds.
- Initial migration succeeds.
- PostgreSQL contains the generated core tables.
- `npx prisma generate` succeeds.
- NestJS still starts successfully after migration.

## Out of Scope

- Auth module
- Password hashing
- User registration/login
- MindSpace CRUD
- Conversation CRUD
- Message sending flow
- Notes CRUD
- Tasks CRUD
- Document upload
- Object Storage integration
- RAG ingestion
- Vector DB schema
- Agent Service
- Seed data
- Soft delete
- Automation
