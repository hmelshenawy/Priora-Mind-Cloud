# 05 — Data Model

## 1. Purpose

This document defines the core relational data model for **Priora MindCloud V1**.

The goal is to keep the model simple, explicit, and easy to evolve.

The main relational database is **PostgreSQL**.

---

# 2. Core Entities

Priora MindCloud V1 contains the following main entities:

```text
User
MindSpace
Conversation
Message
Note
Task
Document
```

---

# 3. High-Level Relationship Model

```text
User
 └── MindSpaces
      ├── Conversations
      │    └── Messages
      ├── Notes
      ├── Tasks
      └── Documents
```

A user can own many MindSpaces.

Each MindSpace can contain:

- many Conversations
- many Notes
- many Tasks
- many Documents

Each Conversation can contain many Messages.

---

# 4. User

Represents the authenticated Priora MindCloud user.

## Main Fields

```text
User
- id
- email
- passwordHash
- createdAt
- updatedAt
```

## Relationships

```text
User 1 ──── N MindSpaces
User 1 ──── N Conversations
User 1 ──── N Messages
User 1 ──── N Notes
User 1 ──── N Tasks
User 1 ──── N Documents
```

---

# 5. MindSpace

Represents a user-created contextual area such as:

```text
Work
Learning
Personal
Priora MindCloud
AI Engineering
```

## Main Fields

```text
MindSpace
- id
- userId
- name
- description
- createdAt
- updatedAt
```

## Relationships

```text
MindSpace N ──── 1 User

MindSpace 1 ──── N Conversations
MindSpace 1 ──── N Notes
MindSpace 1 ──── N Tasks
MindSpace 1 ──── N Documents
```

---

# 6. Conversation

Represents an AI conversation inside a MindSpace.

## Main Fields

```text
Conversation
- id
- userId
- mindSpaceId
- title
- status
- createdAt
- updatedAt
```

Possible status values:

```text
ACTIVE
ARCHIVED
```

## Relationships

```text
Conversation N ──── 1 User
Conversation N ──── 1 MindSpace
Conversation 1 ──── N Messages
```

---

# 7. Message

Represents one message inside a Conversation.

Messages can be created by either the user or the assistant.

## Main Fields

```text
Message
- id
- userId
- conversationId
- role
- content
- createdAt
```

Possible roles:

```text
USER
ASSISTANT
SYSTEM
```

`SYSTEM` can be omitted from persisted messages if system prompts remain runtime-only.

## Relationships

```text
Message N ──── 1 User
Message N ──── 1 Conversation
```

## Why Keep userId?

The user can technically be resolved through:

```text
Message
  ↓
Conversation
  ↓
User
```

However, keeping `userId` directly on Message can simplify:

- ownership filtering
- user-scoped queries
- audit operations
- security checks
- future data export / deletion

For V1, keeping `userId` is acceptable.

---

# 8. Note

Represents user-created or agent-created written knowledge.

## Main Fields

```text
Note
- id
- userId
- mindSpaceId
- title
- content
- createdAt
- updatedAt
```

## Relationships

```text
Note N ──── 1 User
Note N ──── 1 MindSpace
```

---

# 9. Task

Represents an actionable item inside a MindSpace.

## Main Fields

```text
Task
- id
- userId
- mindSpaceId
- title
- description
- status
- executor
- dueAt
- createdAt
- updatedAt
```

Possible status values:

```text
TODO
IN_PROGRESS
DONE
CANCELLED
```

Possible executor values:

```text
USER
AGENT
```

`executor` indicates whether the task is intended for the user or for future agent execution.

Agent automation/execution itself remains outside V1.

## Relationships

```text
Task N ──── 1 User
Task N ──── 1 MindSpace
```

---

# 10. Document

Represents a file uploaded by the user.

The original file is stored in Object Storage.

The PostgreSQL record stores the application-level document state.

## Main Fields

```text
Document
- id
- userId
- mindSpaceId
- fileName
- mimeType
- storageKey
- status
- createdAt
- updatedAt
```

Possible processing status values:

```text
UPLOADED
PROCESSING
READY
FAILED
```

## Relationships

```text
Document N ──── 1 User
Document N ──── 1 MindSpace
```

---

# 11. Document Storage Relationship

A document exists across three storage systems.

```text
                   Document
                 documentId
                     │
          ┌──────────┼──────────┐
          ↓          ↓          ↓
     PostgreSQL      S3       Vector DB
     App record   Original     Chunks
                  file         + vectors
```

## PostgreSQL

Stores:

```text
documentId
userId
mindSpaceId
fileName
storageKey
processing status
timestamps
```

## Object Storage

Stores:

```text
Original PDF / file
```

## Vector Database

Stores:

```text
chunk text
embedding
userId
mindSpaceId
documentId
chunkIndex
page
sourceType
```

---

# 12. Vector Knowledge Model

Vector chunks do not need to be modeled as normal PostgreSQL entities in V1.

The RAG Service owns their storage in the Vector Database.

Example vector payload:

```json
{
  "userId": "user_123",
  "mindSpaceId": "mindspace_123",
  "documentId": "document_123",
  "chunkIndex": 3,
  "page": 7,
  "sourceType": "PDF",
  "text": "..."
}
```

The vector database can use its own generated point ID.

---

# 13. Entity Relationship Summary

```text
User
 │
 ├────< MindSpace
 │        │
 │        ├────< Conversation
 │        │          │
 │        │          └────< Message
 │        │
 │        ├────< Note
 │        │
 │        ├────< Task
 │        │
 │        └────< Document
 │
 ├────< Conversation
 ├────< Message
 ├────< Note
 ├────< Task
 └────< Document
```

The direct `userId` foreign keys keep user ownership explicit even when the same ownership can also be inferred through MindSpace or Conversation.

---

# 14. Foreign Keys

```text
MindSpace.userId
    → User.id

Conversation.userId
    → User.id

Conversation.mindSpaceId
    → MindSpace.id

Message.userId
    → User.id

Message.conversationId
    → Conversation.id

Note.userId
    → User.id

Note.mindSpaceId
    → MindSpace.id

Task.userId
    → User.id

Task.mindSpaceId
    → MindSpace.id

Document.userId
    → User.id

Document.mindSpaceId
    → MindSpace.id
```

---

# 15. Recommended Basic Indexes

At minimum, V1 should index common ownership and parent relationship fields.

```text
MindSpace.userId

Conversation.userId
Conversation.mindSpaceId

Message.userId
Message.conversationId

Note.userId
Note.mindSpaceId

Task.userId
Task.mindSpaceId
Task.status

Document.userId
Document.mindSpaceId
Document.status
```

A useful composite pattern is:

```text
(userId, mindSpaceId)
```

for entities that are frequently queried inside one MindSpace.

---

# 16. Ownership Rule

All user-owned records must always be accessed using the authenticated user context.

Example:

```text
Request
  ↓
JWT
  ↓
userId
  ↓
Service query
  ↓
WHERE id = requestedId
AND userId = authenticatedUserId
```

The Agent must never be trusted to determine ownership by itself.

NestJS remains responsible for ownership and authorization checks.

---

# 17. V1 Data Model Boundary

Included:

```text
User
MindSpace
Conversation
Message
Note
Task
Document
```

Not included in V1:

```text
Nested MindSpaces
Automation entities
Scheduled jobs
External integrations
Knowledge graph entities
Multimodal media models
Multi-user collaboration
Complex agent memory tables
```

These can be added later without changing the core V1 model.

---

# 18. Final V1 Model

```text
User
- id
- email
- passwordHash

MindSpace
- id
- userId
- name

Conversation
- id
- userId
- mindSpaceId
- title

Message
- id
- userId
- conversationId
- role
- content

Note
- id
- userId
- mindSpaceId
- title
- content

Task
- id
- userId
- mindSpaceId
- title
- description
- status
- executor

Document
- id
- userId
- mindSpaceId
- fileName
- storageKey
- status
```

This is the core relational model for **Priora MindCloud V1**.
