# 07 — Software Architecture Document (SAD)

## 1. Purpose

This document defines the software architecture for **Priora MindCloud V1**.

It summarizes the main architecture decisions, service boundaries, responsibilities, communication patterns, storage choices, security rules, and V1 constraints.

Detailed requirements, flows, data models, and endpoints are defined in the earlier design documents.

---

# 2. System Overview

Priora MindCloud is a personal AI assistant and second-brain system.

The core system allows a user to:

- create MindSpaces
- chat with an AI Agent
- store notes
- manage tasks
- upload documents
- ingest document knowledge
- retrieve relevant knowledge through RAG
- allow the Agent to perform supported business actions through tools

The V1 architecture is intentionally simple and service-oriented.

---

# 3. Main Components

```text
User / Client
     ↓
NestJS Backend
     ├── PostgreSQL
     ├── Object Storage
     ├── AI Agent Service
     └── Knowledge / RAG Service
              ↓
          Vector Database
```

Main components:

```text
NestJS Backend
Python Agent Service
Python Knowledge / RAG Service
PostgreSQL
Object Storage
Vector Database
```

---

# 4. Architecture Style

Priora MindCloud V1 uses a modular backend with specialized internal services.

```text
Client
  ↓
NestJS Application Backend
  ↓
Specialized AI Services
```

NestJS remains the main application boundary.

Python services are used for AI-specific workloads.

This avoids moving business logic into the AI services.

---

# 5. Technology Stack

## Application Backend

```text
NestJS
TypeScript
```

Responsibilities:

```text
HTTP API
Authentication
Authorization
Business logic
Ownership validation
Application orchestration
PostgreSQL access
Object Storage coordination
Agent Service communication
RAG Service communication
```

---

## Agent Service

```text
Python
FastAPI
LLM provider/client
```

Responsibilities:

```text
Agent execution
LLM calls
Agent loop
Tool registry
Tool schemas
Tool execution
Agent step limit
Final response generation
```

---

## Knowledge / RAG Service

```text
Python
FastAPI
Embedding model
Vector DB client
```

Responsibilities:

```text
Text extraction
Cleaning
Chunking
Embeddings
Vector persistence
Semantic search
Similarity scoring
Knowledge retrieval
```

---

## Main Database

```text
PostgreSQL
```

Stores structured application data.

---

## Vector Database

Preferred V1 option:

```text
Qdrant
```

Stores:

```text
vector embeddings
chunk text
knowledge metadata
```

---

## Object Storage

S3-compatible storage.

Stores:

```text
original uploaded files
PDFs
future supported file types
```

---

# 6. NestJS Backend Architecture

NestJS owns application business logic.

Conceptual modules:

```text
Auth Module
Users Module
MindSpaces Module
Conversations Module
Notes Module
Tasks Module
Documents Module
AI / Agent Client Module
Knowledge / RAG Client Module
Storage Module
```

Messages are part of the `ConversationsModule` in V1 because a Message does not exist independently from a Conversation.

Conceptually:

```text
ConversationsModule
├── ConversationsController
├── ConversationsService
└── ConversationMessagesService
```

The same controller can expose both conversation and nested message routes:

```text
POST /conversations
GET  /conversations
GET  /conversations/:conversationId

POST /conversations/:conversationId/messages
GET  /conversations/:conversationId/messages
```

`ConversationMessagesService` can remain separate internally because sending a message has its own workflow:

```text
validate conversation
→ validate ownership
→ persist user message
→ load conversation history
→ call Agent Service
→ persist assistant message
→ return response
```

Each normal domain module follows:

```text
Controller
   ↓
Service
   ↓
Repository / ORM
   ↓
PostgreSQL
```

The Agent and RAG modules inside NestJS are thin service clients.

They do not implement AI logic.

---

# 7. Service Responsibility Rules

## NestJS Owns

```text
Users
Authentication
Authorization
MindSpaces
Conversations
Messages
Notes
Tasks
Documents
Business rules
Ownership rules
PostgreSQL writes
Object Storage lifecycle
Application orchestration
```

## Agent Service Owns

```text
LLM interaction
Agent reasoning loop
Tool registry
Tool schemas
Tool routing
Tool result handling
MAX_STEPS
Final AI response
```

## RAG Service Owns

```text
Document text extraction
Text cleaning
Chunking
Embedding generation
Vector storage
Semantic retrieval
Similarity scoring
```

---

# 8. Service Communication

Main communication patterns:

```text
User / Client
    ↓
NestJS
```

Agent execution:

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

Knowledge retrieval during Agent execution:

```text
Agent Service
    ↓
RAG Service
```

Agent business actions:

```text
Agent Service
    ↓
NestJS API
```

---

# 9. Agent Architecture

The Agent is implemented as an execution loop.

```text
Input
 ↓
LLM
 ↓
Tool required?
 ↓
Execute tool
 ↓
Append tool result
 ↓
LLM again
 ↓
Final response
```

Conceptual structure:

```text
Agent Service
├── LLM Client
├── Agent Runner
├── Tool Registry
├── Tool Schemas
└── Tool Executors
```

The Agent does not directly own application data.

---

# 10. Agent Tool Architecture

Tools live inside the Agent Service.

Example tools:

```text
create_task
get_tasks
update_task

create_note
get_notes
update_note

search_knowledge
```

There are two tool categories.

## Business Tools

Call NestJS.

```text
Agent
 ↓
Business Tool
 ↓
NestJS
 ↓
Domain Service
 ↓
PostgreSQL
```

Examples:

```text
create_task
get_tasks
update_task
create_note
get_notes
update_note
```

## Knowledge Tools

Call the RAG Service.

```text
Agent
 ↓
search_knowledge
 ↓
RAG Service
 ↓
Vector DB
```

---

# 11. Agent Safety Boundary

The Agent must not directly access PostgreSQL.

The Agent must not bypass NestJS business rules.

Correct:

```text
Agent Tool
 ↓
NestJS API
 ↓
Service
 ↓
Database
```

Incorrect:

```text
Agent
 ↓
PostgreSQL
```

This keeps authorization and ownership centralized.

---

# 12. Agent Loop Limit

The Agent Service must enforce a maximum number of execution steps.

Example:

```text
MAX_STEPS = 10
```

Conceptual behavior:

```text
while steps < MAX_STEPS:
    call LLM

    if no tool call:
        return final response

    execute tool
    append result
```

If the limit is reached, the Agent should stop execution and produce a controlled final response based on available context.

---

# 13. RAG Architecture

The RAG Service contains two main flows.

```text
RAG Service
├── Ingestion
└── Retrieval
```

## Ingestion

```text
Document
 ↓
Extract text
 ↓
Clean
 ↓
Chunk
 ↓
Embed
 ↓
Store vectors
```

## Retrieval

```text
Query
 ↓
Embed query
 ↓
Vector similarity search
 ↓
Apply user / MindSpace filters
 ↓
Return top relevant chunks
```

---

# 14. RAG Ownership and Filtering

Every knowledge chunk must carry ownership metadata.

Example:

```text
userId
mindSpaceId
documentId
chunkIndex
page
sourceType
```

Retrieval must always be scoped by user.

Typical filter:

```text
userId = authenticated user
mindSpaceId = current MindSpace
```

This prevents knowledge leakage between users or MindSpaces.

---

# 15. Storage Architecture

Priora MindCloud V1 uses three storage systems.

```text
PostgreSQL
Object Storage
Vector Database
```

## PostgreSQL

Stores structured application data:

```text
users
mindspaces
conversations
messages
notes
tasks
documents
processing state
```

## Object Storage

Stores original files.

```text
PDF
future documents
```

## Vector Database

Stores semantic knowledge.

```text
chunks
embeddings
source metadata
```

---

# 16. Document Storage Model

A document spans all three storage systems.

```text
               Document
              documentId
                  │
       ┌──────────┼──────────┐
       ↓          ↓          ↓
 PostgreSQL   Object Store   Vector DB
 App Record   Original File  Chunks
```

The common identifier is:

```text
documentId
```

---

# 17. Database Architecture

The primary relational database is PostgreSQL.

Core entities:

```text
User
MindSpace
Conversation
Message
Note
Task
Document
```

Main ownership hierarchy:

```text
User
 └── MindSpaces
      ├── Conversations
      │    └── Messages
      ├── Notes
      ├── Tasks
      └── Documents
```

Most user-owned entities also store `userId` directly for explicit ownership.

---

# 18. Authentication Architecture

NestJS is responsible for authentication.

Recommended V1 model:

```text
Access Token
Refresh Token
```

Typical request flow:

```text
Request
 ↓
Auth Guard
 ↓
JWT validation
 ↓
Authenticated payload
 ↓
Controller
 ↓
Service
```

The authenticated user ID must come from verified authentication context, not from a client-provided body field.

---

# 19. Authorization and Ownership

Every user-owned resource must be scoped to the authenticated user.

Example:

```text
WHERE
id = requestedId
AND userId = authenticatedUserId
```

This applies to:

```text
MindSpaces
Conversations
Messages
Notes
Tasks
Documents
```

Ownership validation remains in NestJS.

---

# 20. Internal Service Authentication

Internal services must not rely only on network trust.

Internal calls include:

```text
NestJS → Agent Service
NestJS → RAG Service
Agent Service → NestJS
Agent Service → RAG Service
```

V1 can use:

```text
internal service token
```

or:

```text
signed internal JWT
```

The exact implementation can be decided during implementation.

---

# 21. Error Handling

Each service should return controlled errors.

Main categories:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
INTERNAL_ERROR
AGENT_UNAVAILABLE
RAG_UNAVAILABLE
DOCUMENT_PROCESSING_FAILED
```

NestJS should translate internal service failures into stable application responses.

Raw stack traces must not be exposed to clients.

---

# 22. RAG Failure Handling

If document ingestion fails:

```text
RAG Service failure
 ↓
NestJS
 ↓
Document status = FAILED
```

The original file remains in Object Storage.

This allows retry without another upload.

---

# 23. Agent Failure Handling

Possible Agent failures:

```text
LLM unavailable
Tool execution failure
Tool validation failure
MAX_STEPS reached
Agent timeout
```

The Agent Service should return a controlled failure response.

NestJS decides what is persisted and returned to the user.

---

# 24. Logging and Observability

Each request should have a correlation or request ID.

Useful log context:

```text
requestId
userId
conversationId
mindSpaceId
documentId
service
operation
latency
errorCode
```

Sensitive information such as passwords, tokens, and full private document content should not be logged.

---

# 25. Security Principles

V1 security rules:

```text
Never trust client userId
Always validate ownership
Agent cannot access PostgreSQL directly
RAG retrieval must filter by userId
Internal service calls require authentication
Passwords must be hashed
Tokens must not be logged
Uploaded files must be validated
Raw internal errors must not reach the client
```

---

# 26. File Upload Security

The Documents Service should validate:

```text
file type
file size
supported extension
MIME type
```

Storage keys should be generated by the backend.

Example:

```text
users/{userId}/documents/{documentId}/{fileName}
```

Clients should not control unrestricted storage paths.

---

# 27. Deployment View

V1 can initially run as separate local or containerized services.

```text
┌───────────────────────┐
│      User / Client    │
└───────────┬───────────┘
            ↓
┌───────────────────────┐
│     NestJS Backend    │
└───────┬───────┬───────┘
        │       │
        │       ├───────────────┐
        │       │               │
        ↓       ↓               ↓
 PostgreSQL  Object Storage  Agent Service
                                │
                                ↓
                              LLM
                                │
                                ↓
                           RAG Service
                                │
                                ↓
                            Vector DB
```

NestJS can also communicate directly with the RAG Service for ingestion.

---

# 28. V1 Deployment Principle

V1 does not require complex infrastructure.

Avoid initially adding:

```text
Kubernetes
Message brokers
Distributed workflow engines
Complex event buses
Multiple databases for the same domain
```

These should only be introduced when there is a real scaling or reliability requirement.

---

# 29. Synchronous vs Asynchronous Work

Most application APIs can initially be synchronous.

Document ingestion may eventually become asynchronous because embedding large files can be slow.

Possible future architecture:

```text
Upload
 ↓
Create Document
 ↓
Queue ingestion job
 ↓
Worker
 ↓
RAG Service
```

For V1, a simpler implementation is acceptable first.

---

# 30. Scalability Direction

The architecture allows each major component to scale independently later.

```text
NestJS Backend
Agent Service
RAG Service
PostgreSQL
Vector DB
Object Storage
```

No V1 design should require premature distributed complexity.

---

# 31. Architecture Constraints

Priora MindCloud V1 follows these constraints:

```text
Keep architecture simple
NestJS owns business logic
Python owns AI-specific logic
Agent does not directly access app DB
RAG owns vector operations
PostgreSQL is the main app database
Original files remain in Object Storage
Knowledge retrieval is always user-scoped
MindSpaces remain flat in V1
Automations are not part of V1
```

---

# 32. V1 Boundary

Included:

```text
Authentication
MindSpaces
Conversations
Messages
Notes
Tasks
Documents
File upload
Object Storage
Knowledge ingestion
Embeddings
Vector search
RAG
Agent loop
Business tools
Knowledge tools
```

Not included:

```text
Automations
Scheduled triggers
Event-driven agent execution
Gmail integration
Calendar integration
Drive integration
Nested MindSpaces
Knowledge graphs
Multimodal embeddings
Multi-user collaboration
Complex long-term autonomous memory
```

---

# 33. Future V2 Direction

Possible V2 capabilities:

```text
Automations
Scheduled tasks
Conditional triggers
Proactive Agent
Email integrations
Calendar integrations
Cloud Drive integrations
Nested MindSpaces
Agent-executed tasks
Advanced memory
Multimodal knowledge
```

V2 features should extend the existing architecture rather than replace it.

---

# 34. Architecture Decision Summary

## Decision 1

Use **PostgreSQL** as the main application database.

Reason:

```text
Strong relational model
Foreign keys
Ownership relationships
Constraints
Simple querying
```

## Decision 2

Use a separate **Vector Database** for semantic retrieval.

Preferred:

```text
Qdrant
```

## Decision 3

Use **Object Storage** for original uploaded files.

## Decision 4

Keep the **Agent Service separate from NestJS**.

Reason:

```text
Python AI ecosystem
Independent agent development
Clear responsibility boundary
```

## Decision 5

Keep the **RAG Service separate**.

Reason:

```text
Centralized embedding and retrieval logic
Vector DB ownership
Reusable ingestion/search API
```

## Decision 6

Agent tools live in the Agent Service.

Business tools call NestJS.

Knowledge tools call the RAG Service.

## Decision 7

Agent retrieval is part of the Agent flow, not a separate top-level V1 user flow.

## Decision 8

Automations remain V2.

---

# 35. Final Architecture

```text
                           User / Client
                                │
                                ▼
                         NestJS Backend
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
       PostgreSQL         Object Storage       Agent Service
                                                     │
                                                     ▼
                                                    LLM
                                                     │
                                        ┌────────────┴────────────┐
                                        │                         │
                                        ▼                         ▼
                                 Business Tools              Knowledge Tool
                                        │                         │
                                        ▼                         ▼
                                     NestJS                  RAG Service
                                        │                         │
                                        ▼                         ▼
                                   PostgreSQL                 Vector DB

Document ingestion:

NestJS → RAG Service → Vector DB
```

This architecture is the baseline for **Priora MindCloud V1 implementation**.
