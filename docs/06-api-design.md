# 06 — API Design

## 1. Purpose

This document defines the API surface for **Priora MindCloud V1**.

The API is divided into:

1. Client-facing NestJS APIs
2. Internal Agent Service API
3. Internal Knowledge / RAG Service APIs

NestJS is the main application API boundary.

---

# 2. API Conventions

Base prefix:

```text
/api/v1
```

Protected endpoints require authenticated user context.

Authentication can use:

```text
Access Token
Refresh Token
```

Exact cookie/header details can be finalized during implementation.

---

# 3. Authentication API

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

## Register

```http
POST /api/v1/auth/register
```

Request:

```json
{
  "email": "user@example.com",
  "password": "strong-password"
}
```

## Login

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "user@example.com",
  "password": "strong-password"
}
```

## Logout

```http
POST /api/v1/auth/logout
```

## Refresh

```http
POST /api/v1/auth/refresh
```

## Current User

```http
GET /api/v1/auth/me
```

---

# 4. MindSpaces API

```text
POST   /api/v1/mindspaces
GET    /api/v1/mindspaces
GET    /api/v1/mindspaces/:mindSpaceId
PATCH  /api/v1/mindspaces/:mindSpaceId
DELETE /api/v1/mindspaces/:mindSpaceId
```

## Create

Request:

```json
{
  "name": "AI Engineering",
  "description": "Learning and projects related to AI."
}
```

## Get All

Returns MindSpaces owned by the authenticated user.

## Get One

Returns one owned MindSpace.

## Update

Request example:

```json
{
  "name": "AI & Agents"
}
```

## Delete

Delete behavior for child resources should be defined during implementation.

---

# 5. Conversations API

```text
POST   /api/v1/conversations
GET    /api/v1/conversations
GET    /api/v1/conversations/:conversationId
PATCH  /api/v1/conversations/:conversationId
DELETE /api/v1/conversations/:conversationId
```

## Create

Request:

```json
{
  "mindSpaceId": "mindspace_id",
  "title": "RAG Architecture"
}
```

## Get All

Optional filter:

```text
?mindSpaceId=mindspace_id
```

## Update

Request example:

```json
{
  "title": "Priora RAG Architecture",
  "status": "ACTIVE"
}
```

---

# 6. Messages API

Messages are nested under Conversations.

```text
POST /api/v1/conversations/:conversationId/messages
GET  /api/v1/conversations/:conversationId/messages
```

## Send Message

```http
POST /api/v1/conversations/:conversationId/messages
```

Purpose:

```text
Persist user message
→ load conversation context
→ call Agent Service
→ persist assistant message
→ return final response
```

Request:

```json
{
  "content": "What do I know about RAG architecture?"
}
```

Conceptual response:

```json
{
  "userMessage": {
    "id": "message_id",
    "role": "USER",
    "content": "What do I know about RAG architecture?"
  },
  "assistantMessage": {
    "id": "message_id",
    "role": "ASSISTANT",
    "content": "..."
  }
}
```

## Get Messages

Optional pagination:

```text
?limit=50
?cursor=message_id
```

---

# 7. Notes API

```text
POST   /api/v1/notes
GET    /api/v1/notes
GET    /api/v1/notes/:noteId
PATCH  /api/v1/notes/:noteId
DELETE /api/v1/notes/:noteId
```

## Create

Request:

```json
{
  "mindSpaceId": "mindspace_id",
  "title": "RAG Notes",
  "content": "RAG combines retrieval with generation."
}
```

## Get All

Optional filter:

```text
?mindSpaceId=mindspace_id
```

---

# 8. Tasks API

```text
POST   /api/v1/tasks
GET    /api/v1/tasks
GET    /api/v1/tasks/:taskId
PATCH  /api/v1/tasks/:taskId
DELETE /api/v1/tasks/:taskId
```

## Create

Request:

```json
{
  "mindSpaceId": "mindspace_id",
  "title": "Finish RAG module",
  "description": "Complete retrieval implementation.",
  "status": "TODO",
  "executor": "USER",
  "dueAt": null
}
```

## Get All

Optional filters:

```text
?mindSpaceId=mindspace_id
?status=TODO
?executor=USER
```

## Update

Request example:

```json
{
  "status": "DONE"
}
```

---

# 9. Documents API

```text
POST   /api/v1/documents
GET    /api/v1/documents
GET    /api/v1/documents/:documentId
DELETE /api/v1/documents/:documentId
POST   /api/v1/documents/:documentId/retry
```

## Upload Document

```http
POST /api/v1/documents
```

Content type:

```text
multipart/form-data
```

Fields:

```text
file
mindSpaceId
```

Purpose:

```text
Upload original file
→ create PostgreSQL document record
→ trigger RAG ingestion
```

Conceptual response:

```json
{
  "id": "document_id",
  "mindSpaceId": "mindspace_id",
  "fileName": "rag-notes.pdf",
  "status": "PROCESSING"
}
```

Document status:

```text
UPLOADED
PROCESSING
READY
FAILED
```

## Get All

Optional filters:

```text
?mindSpaceId=mindspace_id
?status=READY
```

## Delete

Deletion should remove or coordinate removal of:

```text
PostgreSQL document record
Object Storage file
Vector DB chunks
```

## Retry

```http
POST /api/v1/documents/:documentId/retry
```

Uses the already stored original file.

---

# 10. Agent Service API

The Agent Service is a private Python service.

```text
POST /agent/run
```

## Run Agent

Conceptual request:

```json
{
  "userId": "user_id",
  "conversationId": "conversation_id",
  "mindSpaceId": "mindspace_id",
  "currentMessage": "Create a task to finish the RAG module.",
  "conversationHistory": [
    {
      "role": "USER",
      "content": "..."
    },
    {
      "role": "ASSISTANT",
      "content": "..."
    }
  ],
  "context": {
    "requestId": "request_id"
  }
}
```

Conceptual response:

```json
{
  "content": "Done. I created the task.",
  "usage": {
    "steps": 2
  }
}
```

Exact DTOs will be finalized during implementation.

---

# 11. Agent Business Tool Calls

Business tools call NestJS APIs.

```text
create_task
    → POST /api/v1/tasks

get_tasks
    → GET /api/v1/tasks

update_task
    → PATCH /api/v1/tasks/:taskId

create_note
    → POST /api/v1/notes

get_notes
    → GET /api/v1/notes

update_note
    → PATCH /api/v1/notes/:noteId
```

Rule:

```text
Agent Tool
 ↓
NestJS API
 ↓
Domain Service
 ↓
PostgreSQL
```

The Agent does not access PostgreSQL directly.

---

# 12. Knowledge / RAG Service API

The RAG Service is private and owns:

```text
text extraction
cleaning
chunking
embeddings
vector persistence
semantic retrieval
```

## Ingest

```http
POST /ingest
```

Usually called by NestJS.

Conceptual request:

```json
{
  "userId": "user_id",
  "mindSpaceId": "mindspace_id",
  "documentId": "document_id",
  "storageKey": "users/user_id/documents/document_id/file.pdf"
}
```

Conceptual response:

```json
{
  "documentId": "document_id",
  "status": "READY",
  "chunksCreated": 42
}
```

## Search

```http
POST /search
```

Usually called by the Agent through `search_knowledge`.

Request:

```json
{
  "userId": "user_id",
  "mindSpaceId": "mindspace_id",
  "query": "What do I know about RAG?",
  "topK": 5
}
```

Response:

```json
{
  "results": [
    {
      "documentId": "document_id",
      "chunkIndex": 4,
      "page": 2,
      "text": "...",
      "score": 0.82
    }
  ]
}
```

---

# 13. Internal Service Authentication

These calls must not be treated as anonymous trusted traffic:

```text
NestJS → Agent Service
NestJS → RAG Service
Agent Service → NestJS
Agent Service → RAG Service
```

V1 can use a simple internal mechanism such as:

```text
Internal service token
or
Signed internal JWT
```

Exact implementation can be decided later.

---

# 14. Ownership Rule

Public APIs do not trust a client-supplied `userId`.

Ownership comes from authenticated context:

```text
JWT
 ↓
userId
 ↓
Service query
```

Example:

```text
WHERE id = :taskId
AND userId = authenticatedUserId
```

For internal Agent calls, NestJS still validates the execution context before acting on behalf of the user.

---

# 15. API Summary

## Auth

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
```

## MindSpaces

```text
POST   /api/v1/mindspaces
GET    /api/v1/mindspaces
GET    /api/v1/mindspaces/:mindSpaceId
PATCH  /api/v1/mindspaces/:mindSpaceId
DELETE /api/v1/mindspaces/:mindSpaceId
```

## Conversations

```text
POST   /api/v1/conversations
GET    /api/v1/conversations
GET    /api/v1/conversations/:conversationId
PATCH  /api/v1/conversations/:conversationId
DELETE /api/v1/conversations/:conversationId
```

## Messages

```text
POST   /api/v1/conversations/:conversationId/messages
GET    /api/v1/conversations/:conversationId/messages
```

## Notes

```text
POST   /api/v1/notes
GET    /api/v1/notes
GET    /api/v1/notes/:noteId
PATCH  /api/v1/notes/:noteId
DELETE /api/v1/notes/:noteId
```

## Tasks

```text
POST   /api/v1/tasks
GET    /api/v1/tasks
GET    /api/v1/tasks/:taskId
PATCH  /api/v1/tasks/:taskId
DELETE /api/v1/tasks/:taskId
```

## Documents

```text
POST   /api/v1/documents
GET    /api/v1/documents
GET    /api/v1/documents/:documentId
DELETE /api/v1/documents/:documentId
POST   /api/v1/documents/:documentId/retry
```

## Agent Service

```text
POST /agent/run
```

## RAG Service

```text
POST /ingest
POST /search
```

---

# 16. V1 API Boundary

```text
User / Client
 ↓
NestJS API
```

AI execution:

```text
NestJS
 ↓
Agent Service
```

Document ingestion:

```text
NestJS
 ↓
RAG Service
```

Knowledge retrieval during Agent reasoning:

```text
Agent Service
 ↓
RAG Service
```

Business action initiated by Agent:

```text
Agent Tool
 ↓
NestJS API
 ↓
Domain Service
 ↓
PostgreSQL
```

This defines the API surface for **Priora MindCloud V1**.
