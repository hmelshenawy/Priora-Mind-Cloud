# 04 — System Flows

## 1. Purpose

This document defines the main end-to-end runtime flows for **Priora MindCloud V1**.

It focuses on flows that cross multiple system components. Standard CRUD operations are covered by the Functional Requirements and are not repeated in detail unless they participate in a larger system flow.

## 2. Main V1 System Flows

1. Conversation + Agent Flow
2. Document Upload + Knowledge Ingestion Flow
3. Agent Business Tool Flow

---

# 3. Conversation + Agent Flow

## Purpose

Handles a user sending a message inside an existing conversation and receiving an AI response.

## Flow

```text
User / Client
    ↓
POST /conversations/:conversationId/messages
    ↓
NestJS Auth Guard
    ↓
Passport JWT Strategy
    ↓
Validate token + extract user payload
    ↓
Conversation Controller
    ↓
Conversation Service
    ↓
Validate conversation exists
    ↓
Validate conversation belongs to user
    ↓
Validate conversation can receive messages
    ↓
Persist user message in PostgreSQL
    ↓
Load relevant conversation history/context
    ↓
AI Service / Agent Client
    ↓
Call Python Agent Service
    ↓
Agent Loop
    ↓
LLM
    ↓
Tool required?
```

If no tool is required:

```text
LLM
 ↓
Final Response
 ↓
Agent Service
 ↓
NestJS
 ↓
Persist assistant message
 ↓
Return response
 ↓
User / Client
```

If a tool is required:

```text
LLM
 ↓
Tool Call
 ↓
Validate tool + arguments
 ↓
Tool Registry
 ↓
Tool Executor
 ↓
NestJS API OR RAG Service
 ↓
Tool Result
 ↓
Append result to agent state
 ↓
Call LLM again
 ↓
Continue loop if needed
 ↓
Final Response
 ↓
NestJS
 ↓
Persist assistant message
 ↓
User / Client
```

## Agent Request Context

The Agent request may contain:

- userId
- conversationId
- mindSpaceId
- currentMessage
- conversationHistory
- authentication / execution context

The exact DTO will be defined during API design.

## RAG Retrieval Sub-Flow

Knowledge retrieval is part of the Agent flow rather than a separate top-level V1 flow.

```text
Agent
 ↓
LLM decides to call search_knowledge
 ↓
search_knowledge Tool
 ↓
RAG Service
 ↓
Embed query
 ↓
Vector similarity search
 ↓
Filter by userId + mindSpaceId
 ↓
Top chunks + similarity scores + source metadata
 ↓
Agent
 ↓
Append tool result
 ↓
LLM
 ↓
Continue Agent Loop
```

## Agent Loop Limit

The Agent Service must enforce `MAX_STEPS` to prevent infinite tool-calling loops.

---

# 4. Document Upload + Knowledge Ingestion Flow

## Purpose

Handles uploading a document, preserving the original file, creating its application record, and ingesting its content into semantic knowledge.

## Flow

```text
User / Client
    ↓
HTTP request with file
    ↓
NestJS Auth Guard
    ↓
Passport JWT Strategy
    ↓
Validate token + extract user payload
    ↓
Documents Controller
    ↓
Documents Service
    ↓
Validate MindSpace exists
    ↓
Validate MindSpace belongs to user
    ↓
Validate file type / file rules
    ↓
Upload original file to Object Storage / S3
    ↓
Create Document record in PostgreSQL
    ↓
status = PROCESSING
    ↓
Call Python RAG Service
    ↓
Read / receive source document
    ↓
Extract text
    ↓
Clean text
    ↓
Chunk text
    ↓
Generate embeddings
    ↓
Store chunks + vectors + metadata
    ↓
Vector Database
    ↓
Return ingestion result to NestJS
    ↓
Update Document status = READY
    ↓
Return document response
    ↓
User / Client
```

## Document Relationship

```text
             PostgreSQL Document
                 documentId
                     │
            ┌────────┴────────┐
            ↓                 ↓
      Object Storage      Vector Database
      Original File       Chunks + Vectors
```

This allows the system to locate, delete, retry, or reprocess a document and its semantic knowledge.

## Vector Metadata

Each chunk should carry enough information to identify its owner, scope, and source.

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

## Failure

```text
RAG Service fails
    ↓
NestJS Documents Service
    ↓
Document status = FAILED
```

The original file remains in Object Storage so processing can be retried without another upload.

## Retry

```text
User / Client
    ↓
Request retry
    ↓
NestJS validates document ownership
    ↓
Locate original stored file
    ↓
status = PROCESSING
    ↓
Call RAG Service
    ↓
Reprocess
    ↓
Success → READY
Failure → FAILED
```

---

# 5. Agent Business Tool Flow

## Purpose

Allows the Agent to perform supported application actions such as creating or updating tasks and notes.

Tools are registered inside the Agent Service, but application business logic remains in NestJS.

## Example: create_task

User:

```text
"Create a task to finish the RAG module."
```

Flow:

```text
User / Client
    ↓
Conversation + Agent Flow
    ↓
Agent Service
    ↓
LLM
    ↓
LLM chooses create_task
    ↓
Tool Registry
    ↓
Validate tool + arguments
    ↓
create_task Tool Executor
    ↓
POST /tasks → NestJS
    ↓
Authentication / execution context validation
    ↓
Tasks Controller
    ↓
Tasks Service
    ↓
Validate MindSpace
    ↓
Validate ownership / permissions
    ↓
Validate task data
    ↓
Create task in PostgreSQL
    ↓
Return created task
    ↓
Tool Result
    ↓
Agent
    ↓
Append result to message state
    ↓
Call LLM again
    ↓
Final Response
    ↓
NestJS
    ↓
Persist assistant message
    ↓
User / Client
```

## Business Tool Rule

```text
Agent Tool
    ↓
NestJS
    ↓
Domain Service
    ↓
PostgreSQL
```

The Agent must not directly modify PostgreSQL.

The Agent decides what action to request. NestJS remains responsible for validation, authorization, ownership, business rules, and database operations.

---

# 6. Tool Routing

## Business Tools

```text
create_task ─────────→ NestJS
get_tasks ───────────→ NestJS
update_task ─────────→ NestJS

create_note ─────────→ NestJS
get_notes ───────────→ NestJS
update_note ─────────→ NestJS
```

## Knowledge Tools

```text
search_knowledge ────→ RAG Service
```

Overall:

```text
                 Agent Service
                      │
           ┌──────────┴──────────┐
           ↓                     ↓
     Business Tools        Knowledge Tools
           ↓                     ↓
         NestJS              RAG Service
           ↓                     ↓
      PostgreSQL             Vector DB
```

---

# 7. Standard CRUD Flow

MindSpaces, Notes, Tasks, and other standard CRUD operations generally follow:

```text
User / Client
    ↓
HTTP Request
    ↓
Auth Guard
    ↓
JWT Strategy / Payload
    ↓
Controller
    ↓
Service
    ↓
Ownership + Business Validation
    ↓
PostgreSQL
    ↓
Response
    ↓
User / Client
```

Their detailed behavior is defined in `02-functional-requirements.md`.

---

# 8. Flow Ownership Summary

## Conversation + Agent

```text
NestJS
 ↓
Agent Service
 ↓
LLM
 ↓
Tools when required
 ↓
Final Response
 ↓
NestJS
```

## Document Ingestion

```text
NestJS
 ↓
Object Storage + PostgreSQL
 ↓
RAG Service
 ↓
Vector Database
```

## Agent Knowledge Tool

```text
Agent
 ↓
RAG Service
 ↓
Vector Database
```

## Agent Business Tool

```text
Agent
 ↓
NestJS
 ↓
Domain Module
 ↓
PostgreSQL
```

---

# 9. V1 Runtime Overview

```text
                         User / Client
                              │
                              ▼
                       NestJS Backend
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
     PostgreSQL         Object Storage       Agent Service
                                                  │
                                                  ▼
                                                 LLM
                                                  │
                                     ┌────────────┴────────────┐
                                     ▼                         ▼
                              Business Tool              Knowledge Tool
                                     │                         │
                                     ▼                         ▼
                                  NestJS                  RAG Service
                                     │                         │
                                     ▼                         ▼
                                PostgreSQL                 Vector DB

NestJS can also call the RAG Service directly for document ingestion:

NestJS → RAG Service → Vector DB
```

These flows define the primary runtime behavior of **Priora MindCloud V1**.
