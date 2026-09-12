# 08 — Implementation Plan

## 1. Purpose

This document defines the implementation order for **Priora MindCloud V1**.

It translates the approved product and architecture design into practical implementation phases.

This file is intentionally higher-level than individual ticket files.

Structure:

```text
Design Documents
      ↓
Implementation Plan
      ↓
Phase Tickets
      ↓
Code
```

---

# 2. Implementation Principles

The implementation should follow these rules:

```text
Build foundations before integrations
Finish NestJS before moving to RAG
Finish RAG before moving to Agent
Keep modules simple
Do not over-engineer V1
Keep business logic in NestJS
Keep Agent logic in Python
Keep RAG logic in Python
Do not let Agent access PostgreSQL directly
Test each phase before moving forward
```

## Simplicity and Anti-Overengineering Rules

- Use the simplest implementation that correctly solves the current requirement.
- Do not create a class when a function is sufficient.
- Do not create an interface unless there is a real abstraction boundary, multiple implementations, or a clear testing/integration need.
- Do not create abstract classes, factories, adapters, repositories, wrappers, managers, handlers, or providers unless they solve a current architectural requirement.
- Do not introduce design patterns only for architectural appearance.
- Do not split one simple operation into multiple functions unless the split improves readability, reuse, testing, or separates genuinely different responsibilities.
- If one clear function can perform the task cleanly, prefer one function.
- Do not create helper functions that are used once when the logic is already simple and readable inline.
- Do not create files, classes, interfaces, DTOs, types, or layers that are not currently required.
- Prefer direct code over unnecessary indirection.
- Prefer composition and simple functions before inheritance.
- Do not build abstractions for hypothetical future requirements.
- Refactor into abstractions only when the code demonstrates a real need.

Before adding a new abstraction, ask:

1. What current problem does this abstraction solve?
2. Is there more than one implementation or responsibility that requires it?
3. Would the code be simpler without it?

If there is no concrete reason, do not add the abstraction.

## Code Quality Principles

```text
Prefer simple implementations over unnecessary abstractions
Avoid premature generic frameworks
Keep responsibilities clear and focused
Prefer small, readable functions and classes
Keep source files under approximately 300 lines where practical
If a file grows beyond 300 lines, review whether it has multiple responsibilities
Do not split files only to satisfy a line-count rule
Introduce abstractions only when they solve a real current problem
```

The ~300 line limit is a guideline, not a hard rule.


---

# 3. Recommended Implementation Order

Implementation is intentionally sequential.

```text
Phase 1  — NestJS Project Setup & Infrastructure
Phase 2  — Authentication & User
Phase 3  — MindSpaces
Phase 4  — Conversations & Messages
Phase 5  — Notes
Phase 6  — Tasks
Phase 7  — Documents & Object Storage

-------- NestJS DONE --------

Phase 8  — Knowledge / RAG Service

-------- RAG DONE --------

Phase 9  — Agent Service

-------- AGENT DONE --------

Phase 10 — Full Service Integration
Phase 11 — End-to-End Validation & Hardening
```

---

# 4. Phase 1 — NestJS Project Setup & Infrastructure

## Goal

Create the NestJS backend foundation and all core infrastructure required by the application modules.

## Main Tasks

### Project Setup

```text
Create NestJS application
Configure environment handling
Configure global ValidationPipe
Configure global API prefix
Configure error handling baseline
Configure logging baseline
Create module folder structure
```

### Database

```text
Configure PostgreSQL connection
Choose and configure ORM
Create initial database schema
Create migrations
```

### Infrastructure Adapters

```text
Configure Object Storage client abstraction
Configure Qdrant client abstraction for later use
Create request / correlation ID support
Create shared error response pattern
```

## Initial Entities

```text
User
MindSpace
Conversation
Message
Note
Task
Document
```

## Important Constraints

```text
Foreign keys defined
Ownership fields defined
Created/updated timestamps defined
Useful indexes added
Document processing status defined
Task status / executor enums defined
```

## Acceptance Criteria

```text
NestJS starts successfully
Environment config loads correctly
Application connects to PostgreSQL
Initial migration succeeds
Core tables exist
Object Storage client can connect
Qdrant client configuration exists for later RAG integration
Infrastructure adapters are isolated from domain services
No AI logic implemented yet
```

---

# 5. Phase 2 — Authentication & User

## Goal

Implement user identity and protected API access.

## API Scope

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

## Main Tasks

```text
Create AuthModule
Create UsersModule if needed
Create User entity/model
Create registration flow
Hash passwords
Create login flow
Issue access token
Issue refresh token
Create JWT strategy
Create AuthGuard
Create refresh flow
Create logout flow
Create current-user endpoint
```

## Security Rules

```text
Never return password hash
Never trust userId from request body
Use authenticated payload as source of user identity
Protect authenticated routes
```

## Acceptance Criteria

```text
User can register
User can login
Protected route rejects unauthenticated request
Authenticated request receives user context
Refresh works
Logout invalidates / clears auth state
GET /auth/me returns current user
```

---

# 6. Phase 3 — MindSpaces

## Goal

Implement the primary user context container.

## API Scope

```text
POST   /api/v1/mindspaces
GET    /api/v1/mindspaces
GET    /api/v1/mindspaces/:mindSpaceId
PATCH  /api/v1/mindspaces/:mindSpaceId
DELETE /api/v1/mindspaces/:mindSpaceId
```

## Main Tasks

```text
Create MindSpacesModule
Create controller
Create service
Create DTOs
Create database model
Implement CRUD
Implement ownership filters
Implement validation
```

## Acceptance Criteria

```text
User can create a MindSpace
User can list only own MindSpaces
User can read one owned MindSpace
User can update own MindSpace
User cannot access another user's MindSpace
Delete behavior is controlled
```

---

# 7. Phase 4 — Conversations & Messages

## Goal

Implement conversations and message persistence before AI integration.

## Module Decision

Messages remain inside:

```text
ConversationsModule
```

Conceptual structure:

```text
ConversationsModule
├── ConversationsController
├── ConversationsService
└── ConversationMessagesService
```

## API Scope

```text
POST   /api/v1/conversations
GET    /api/v1/conversations
GET    /api/v1/conversations/:conversationId
PATCH  /api/v1/conversations/:conversationId
DELETE /api/v1/conversations/:conversationId

POST   /api/v1/conversations/:conversationId/messages
GET    /api/v1/conversations/:conversationId/messages
```

## Main Tasks

### Conversation CRUD

```text
Create conversation
Validate MindSpace ownership
List conversations
Filter by MindSpace
Get one conversation
Update conversation
Delete / archive conversation
```

### Messages

```text
Create Message model
Store user messages
Store assistant messages
Validate parent conversation
Validate ownership
Get conversation messages
Add pagination
Create conversation-history query
```

## Temporary Behavior

Before Agent integration, message send can initially:

```text
store user message
return placeholder / mocked assistant behavior
```

or stop after persistence while Agent phase is pending.

## Acceptance Criteria

```text
Conversation CRUD works
Messages belong to a conversation
Conversation belongs to authenticated user
Message history can be retrieved
Message ordering is stable
History loading logic exists
```

---

# 8. Phase 5 — Notes

## Goal

Implement user notes inside MindSpaces.

## API Scope

```text
POST   /api/v1/notes
GET    /api/v1/notes
GET    /api/v1/notes/:noteId
PATCH  /api/v1/notes/:noteId
DELETE /api/v1/notes/:noteId
```

## Main Tasks

```text
Create NotesModule
Create controller
Create service
Create DTOs
Create database model
Implement CRUD
Filter by MindSpace
Enforce ownership
```

## Acceptance Criteria

```text
User can create notes
Notes belong to user and MindSpace
Filtering by MindSpace works
Ownership is enforced
CRUD operations work
```

---

# 9. Phase 6 — Tasks

## Goal

Implement task management before exposing it to Agent tools.

## API Scope

```text
POST   /api/v1/tasks
GET    /api/v1/tasks
GET    /api/v1/tasks/:taskId
PATCH  /api/v1/tasks/:taskId
DELETE /api/v1/tasks/:taskId
```

## Main Tasks

```text
Create TasksModule
Create controller
Create service
Create DTOs
Create database model
Implement CRUD
Implement task status
Implement executor field
Implement filters
Enforce ownership
```

## Suggested V1 Enums

```text
TaskStatus:
TODO
IN_PROGRESS
DONE
CANCELLED
```

```text
TaskExecutor:
USER
AGENT
```

`AGENT` does not imply V1 automation.

## Acceptance Criteria

```text
Task CRUD works
Task belongs to user and MindSpace
Status updates work
Executor is stored
Filters work
Agent automation is not implemented
```

---

# 10. Phase 7 — Documents & Object Storage

## Goal

Implement document lifecycle and original-file storage.

## API Scope

```text
POST   /api/v1/documents
GET    /api/v1/documents
GET    /api/v1/documents/:documentId
DELETE /api/v1/documents/:documentId
POST   /api/v1/documents/:documentId/retry
```

## Main Tasks

```text
Create DocumentsModule
Create controller
Create service
Create DTOs
Configure multipart upload
Validate file size
Validate file type
Generate safe storage key
Upload original file to Object Storage
Create Document record
Implement document status
Implement retrieval
Implement delete lifecycle
Implement retry entry point
```

## Document Status

```text
UPLOADED
PROCESSING
READY
FAILED
```

## Acceptance Criteria

```text
User can upload supported file
Original file exists in Object Storage
Document record exists in PostgreSQL
Document belongs to user and MindSpace
Invalid file is rejected
Delete coordinates storage cleanup
Retry endpoint exists
```

---

# 11. Phase 8 — Knowledge / RAG Service

## Goal

Implement document ingestion and semantic retrieval.

## Service Scope

```text
POST /ingest
POST /search
```

## Internal Structure

```text
RAG Service
├── Ingestion
│   ├── Extract
│   ├── Clean
│   ├── Chunk
│   ├── Embed
│   └── Store
└── Retrieval
    ├── Embed Query
    ├── Search
    ├── Filter
    └── Return Results
```

## Main Tasks

### Ingestion

```text
Receive document context
Read/download source file
Extract PDF text
Clean text
Chunk text
Generate embeddings
Store chunks in Qdrant
Store metadata
Return ingestion summary
```

### Retrieval

```text
Accept query
Generate query embedding
Search Qdrant
Filter by userId
Filter by MindSpace
Return topK results
Return similarity score
Return source metadata
```

## Required Vector Metadata

```text
userId
mindSpaceId
documentId
chunkIndex
page
text
sourceType
```

## Acceptance Criteria

```text
PDF can be ingested
Chunks are generated
Embeddings are stored
Search returns relevant chunks
Search is scoped by userId
MindSpace filtering works
No cross-user knowledge leakage
```

---

# 12. Phase 9 — Agent Service

## Goal

Implement the AI Agent loop and tool system.

## Service Scope

```text
POST /agent/run
```

## Internal Structure

```text
Agent Service
├── LLM Client
├── Agent Runner
├── Tool Registry
├── Tool Schemas
└── Tool Executors
```

## Main Tasks

```text
Create LLM client abstraction
Create Agent request/response models
Create message construction
Create Agent loop
Support zero tool calls
Support one tool call
Support multiple sequential tool calls
Implement MAX_STEPS
Implement tool registry
Implement tool argument validation
Append assistant tool-call messages
Append tool results
Generate final response
```

## Initial Tools

Business tools:

```text
create_task
get_tasks
update_task

create_note
get_notes
update_note
```

Knowledge tool:

```text
search_knowledge
```

## Acceptance Criteria

```text
Agent answers without tools
Agent can select a tool
Tool arguments are parsed safely
Tool result returns to LLM
Agent can continue after tool result
MAX_STEPS prevents infinite loop
Final answer is returned
```

---

# 13. Phase 10 — Full Service Integration

## Goal

Connect the three services into the final V1 runtime flow.

---

## 11.1 Conversation + Agent Integration

Final flow:

```text
POST /conversations/:conversationId/messages
 ↓
Auth
 ↓
Validate conversation
 ↓
Persist user message
 ↓
Load conversation history
 ↓
Call Agent Service
 ↓
Agent runs
 ↓
Return final response
 ↓
Persist assistant message
 ↓
Return to user
```

## Main Tasks

```text
Create Agent client in NestJS
Define Agent internal DTO
Pass user context
Pass conversation context
Pass history
Handle Agent timeout
Handle Agent errors
Persist assistant response
```

---

## 11.2 Document + RAG Integration

Flow:

```text
Upload document
 ↓
Object Storage
 ↓
Document status PROCESSING
 ↓
Call RAG /ingest
 ↓
Store vectors
 ↓
READY
```

On failure:

```text
FAILED
```

## Main Tasks

```text
Create RAG client in NestJS
Call /ingest
Map success result
Map failure result
Update document status
Support retry
```

---

## 11.3 Agent Business Tool Integration

Flow:

```text
Agent
 ↓
create_task
 ↓
NestJS API
 ↓
TasksService
 ↓
PostgreSQL
 ↓
result
 ↓
Agent
```

## Main Tasks

```text
Create internal service authentication
Allow Agent Service to call permitted NestJS APIs
Preserve user execution context
Validate ownership in NestJS
Return structured tool result
```

---

## 11.4 Agent Knowledge Tool Integration

Flow:

```text
Agent
 ↓
search_knowledge
 ↓
RAG /search
 ↓
Qdrant
 ↓
results
 ↓
Agent
```

## Acceptance Criteria

```text
Chat reaches Agent
Agent can search knowledge
Agent can create/read/update supported business resources
NestJS remains the business logic owner
Agent never writes directly to PostgreSQL
Document ingestion updates status correctly
```

---

# 14. Phase 11 — End-to-End Validation & Hardening

## Goal

Validate the complete V1 system and close major reliability/security gaps.

## Main Test Scenarios

### Authentication

```text
Register
Login
Refresh
Logout
Unauthorized access
```

### MindSpaces

```text
CRUD
Ownership
```

### Conversations

```text
Create conversation
Send message
Load history
Receive assistant response
```

### Notes / Tasks

```text
CRUD
MindSpace filters
Ownership
```

### Documents

```text
Upload PDF
Store original
Ingest
READY status
FAILED status
Retry
Delete
```

### RAG

```text
Relevant retrieval
Low-relevance retrieval
User isolation
MindSpace isolation
```

### Agent

```text
Normal answer
Knowledge tool
Business tool
Multiple tools
Tool failure
LLM failure
MAX_STEPS
```

## Hardening Tasks

```text
Review validation
Review ownership filters
Review logs
Remove sensitive logs
Add correlation IDs everywhere
Add service timeouts
Add controlled internal errors
Check file upload security
Check internal service auth
Check database indexes
```

## Acceptance Criteria

```text
Critical V1 flows work end-to-end
No known ownership bypass
No Agent direct DB access
No cross-user RAG leakage
Failures return controlled responses
Core tests pass
```

---

# 15. Testing Strategy

Testing should be added continuously, not only in Phase 12.

Recommended layers:

```text
Unit Tests
Integration Tests
Contract Tests
End-to-End Tests
```

## NestJS

Focus on:

```text
services
guards
ownership
DTO validation
business rules
client adapters
```

## Agent Service

Focus on:

```text
tool parsing
tool registry
loop behavior
MAX_STEPS
tool failure
LLM adapter
```

## RAG Service

Focus on:

```text
chunking
embedding interface
metadata
search filters
retrieval ranking
```

---

# 16. Ticket Generation Strategy

Each phase should be broken into small ticket files before coding that phase.

Example:

```text
Phase 3 — Authentication

T001-create-auth-module.md
T002-create-user-model.md
T003-implement-register.md
T004-implement-login.md
T005-implement-jwt-strategy.md
T006-implement-auth-guard.md
T007-implement-refresh.md
T008-implement-logout.md
T009-add-auth-tests.md
```

Tickets should contain:

```text
Goal
Scope
Dependencies
Files / modules affected
Implementation requirements
Acceptance criteria
Out of scope
```

---

# 17. Dependency Map

```text
NestJS Setup + Infrastructure
        ↓
Authentication
        ↓
MindSpaces
        ↓
Conversations + Messages
        ↓
Notes
        ↓
Tasks
        ↓
Documents + Object Storage

-------- NestJS COMPLETE --------

        ↓
RAG Service
  ingestion
  retrieval
  Qdrant

-------- RAG COMPLETE --------

        ↓
Agent Service
  LLM client
  agent loop
  business tools
  search_knowledge

-------- AGENT COMPLETE --------

        ↓
Full Integration
        ↓
E2E + Hardening
```

---

# 18. Recommended Coding Sequence

Within implementation, use this practical sequence:

```text
1. Setup NestJS
2. Setup PostgreSQL
3. Core infrastructure
4. Auth
5. MindSpaces
6. Conversation CRUD
7. Message persistence
8. Notes
9. Tasks
10. Document upload + Object Storage

---- NestJS complete ----

11. Setup RAG Service
12. PDF extraction
13. Chunking
14. Embeddings
15. Qdrant storage
16. RAG search

---- RAG complete ----

17. Setup Agent Service
18. LLM client
19. Agent loop
20. search_knowledge tool
21. task tools
22. note tools

---- Agent complete ----

23. Conversation → Agent integration
24. Document → RAG integration
25. Internal service authentication
26. E2E tests
27. Hardening
```

---

# 19. V1 Completion Definition

Priora MindCloud V1 is considered functionally complete when the user can:

```text
Create an account
Login
Create MindSpaces
Create conversations
Send chat messages
Receive AI responses
Create and manage notes
Create and manage tasks
Upload PDFs
Store original files
Ingest document knowledge
Search personal knowledge semantically
Ask Agent questions using personal knowledge
Allow Agent to create/update supported tasks and notes
Retrieve conversation history
Use all features with correct user ownership isolation
```

The following are explicitly not required for V1 completion:

```text
Automations
Scheduled execution
Email integration
Calendar integration
Cloud Drive integration
Nested MindSpaces
Multimodal understanding
Knowledge graph
Multi-user collaboration
```

---

# 20. Final Implementation Roadmap

```text
PHASE 1
NestJS Setup + Infrastructure
    ↓
PHASE 2
Authentication
    ↓
PHASE 3
MindSpaces
    ↓
PHASE 4
Conversations + Messages
    ↓
PHASE 5
Notes
    ↓
PHASE 6
Tasks
    ↓
PHASE 7
Documents + Object Storage

======== NESTJS DONE ========

    ↓
PHASE 8
RAG Service

========= RAG DONE ==========

    ↓
PHASE 9
Agent Service

======== AGENT DONE =========

    ↓
PHASE 10
Full Service Integration
    ↓
PHASE 11
E2E Validation + Hardening
```

This is the implementation baseline for **Priora MindCloud V1**.
