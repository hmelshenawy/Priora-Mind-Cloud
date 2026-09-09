# 03 — High-Level Architecture

## 1. Purpose

This document defines the **high-level architecture for Priora MindCloud V1**.

The goal is to describe the main system components, their responsibilities, and how they communicate.

This document intentionally avoids low-level implementation details.

---

# 2. High-Level System Components

Priora MindCloud V1 consists of the following main components:

1. User / Client
2. NestJS Backend
3. AI Agent Service
4. Knowledge / RAG Service
5. PostgreSQL
6. Vector Database
7. Object Storage

---

# 3. High-Level Architecture

```text
User / Client
      ↓
NestJS Backend
      │
      ├── PostgreSQL
      │
      ├── Object Storage
      │
      ├── AI Agent Service (Python)
      │
      └── Knowledge / RAG Service (Python)
                     ↓
                Vector Database
```

The NestJS backend acts as the main application entry point.

The User / Client communicates with NestJS rather than directly calling internal AI or data services.

---

# 4. NestJS Backend Responsibilities

NestJS is the main application backend and owns the core application and business logic.

Responsibilities include:

- Authentication
- User management
- Authorization
- Ownership validation
- MindSpaces
- Conversations
- Messages
- Notes
- Tasks
- Documents
- PostgreSQL access
- Object storage integration
- Calling the AI Agent Service
- Calling the Knowledge / RAG Service when required
- Persisting application state

NestJS remains the source of truth for structured application behavior.

---

# 5. AI Agent Service

The AI Agent Service is implemented as a separate Python service.

It is responsible for the intelligent agent execution layer.

Responsibilities include:

- Calling the LLM
- Maintaining the agent execution loop
- Tool selection
- Tool execution orchestration
- Tool registry
- Tool schemas
- Validating tool arguments
- Handling multiple tool calls
- Enforcing a maximum step limit
- Returning the final agent response

High-level structure:

```text
AI Agent Service
│
├── LLM Client
├── Agent Loop
├── Tool Registry
├── Tool Schemas
└── Tool Executors
```

---

# 6. Agent Tools

Tools are defined and registered inside the AI Agent Service.

However, the tool does not necessarily own the underlying business logic.

A tool acts as an adapter to the service that owns the requested operation.

---

## 6.1 Business Tools

Business tools call the NestJS backend.

Examples:

```text
create_task
get_tasks
update_task
create_note
get_notes
```

Flow:

```text
Agent
  ↓
create_task tool
  ↓
POST /tasks
  ↓
NestJS
  ↓
Task Service
  ↓
PostgreSQL
```

NestJS remains responsible for:

- Validation
- Authorization
- Ownership
- Business rules
- Database writes

The Agent is responsible for deciding when to use the tool and providing the required arguments.

---

## 6.2 Knowledge Tools

Knowledge-related tools call the Knowledge / RAG Service directly.

Example:

```text
search_knowledge
```

Flow:

```text
Agent
  ↓
search_knowledge tool
  ↓
Knowledge / RAG Service
  ↓
Vector Database
  ↓
Relevant chunks + similarity scores
  ↓
Agent
```

The Agent can therefore use retrieval as part of its reasoning loop without routing every retrieval call back through NestJS.

---

# 7. Knowledge / RAG Service

The Knowledge / RAG Service is implemented as a separate Python service.

It owns all vector knowledge operations.

Responsibilities include:

## Ingestion

- Receive text or document content
- Extract text
- Clean content
- Chunk content
- Generate embeddings
- Store vectors
- Store vector metadata
- Reprocess existing knowledge when required

## Retrieval

- Receive search query
- Generate query embedding
- Perform similarity search
- Filter by user
- Filter by MindSpace
- Return top results
- Return similarity scores
- Return source metadata

High-level structure:

```text
Knowledge / RAG Service
│
├── Ingestion
│   ├── Extract
│   ├── Clean
│   ├── Chunk
│   ├── Embed
│   └── Store
│
└── Retrieval
    ├── Embed Query
    ├── Similarity Search
    ├── Filter
    └── Return Results
```

---

# 8. NestJS to RAG Communication

NestJS can call the Knowledge / RAG Service directly.

This is mainly used for application-driven knowledge operations such as document ingestion.

Example:

```text
User uploads PDF
      ↓
NestJS Documents Module
      ↓
Store original file
      ↓
Create document record
      ↓
Call Knowledge / RAG Service
      ↓
Extract
      ↓
Chunk
      ↓
Embed
      ↓
Store in Vector Database
```

NestJS does not contain the actual RAG logic.

It only initiates or manages application-level workflows that require the RAG service.

A thin RAG/Knowledge client may exist in NestJS for service communication.

---

# 9. Agent to RAG Communication

The Agent Service can call the Knowledge / RAG Service directly through a registered tool.

Example:

```text
User asks a question
      ↓
NestJS
      ↓
Agent Service
      ↓
LLM decides knowledge is required
      ↓
search_knowledge tool
      ↓
RAG Service
      ↓
Vector Database
      ↓
Relevant knowledge
      ↓
Agent continues
      ↓
Final response
      ↓
NestJS
```

This keeps knowledge retrieval inside the agent reasoning flow.

---

# 10. PostgreSQL

PostgreSQL is the primary application database.

It stores structured application data.

Examples:

- Users
- MindSpaces
- Conversations
- Messages
- Notes
- Tasks
- Documents
- Document processing status
- Application state

PostgreSQL is not only a metadata store.

It is the source of truth for structured application data.

---

# 11. Vector Database

The Vector Database stores semantic knowledge.

It is accessed through the Knowledge / RAG Service.

It stores:

- Embeddings
- Text chunks
- Document references
- User references
- MindSpace references
- Chunk index
- Page number
- Source metadata

Example:

```json
{
  "documentId": "doc_123",
  "mindSpaceId": "space_123",
  "userId": "user_123",
  "chunkIndex": 4,
  "page": 7,
  "text": "..."
}
```

NestJS and the AI Agent Service do not directly manage vector database operations.

The Knowledge / RAG Service owns this responsibility.

---

# 12. Object Storage

Object Storage stores original uploaded files.

Examples include:

- PDF files
- Future image files
- Other supported documents

The original file is preserved so the system can reprocess it later if:

- The chunking strategy changes
- The embedding model changes
- Extraction logic changes
- Vector data must be rebuilt

NestJS owns the application-level file lifecycle.

---

# 13. Main Communication Rules

The following communication rules define the V1 boundaries.

```text
User / Client
      ↓
NestJS
```

The client communicates through NestJS.

---

```text
NestJS
  ↓
Agent Service
```

NestJS calls the Agent Service for AI-agent interaction.

---

```text
NestJS
  ↓
RAG Service
```

NestJS calls the RAG Service for application-driven ingestion and knowledge operations.

---

```text
Agent Service
      ↓
RAG Service
```

The Agent calls the RAG Service directly for semantic knowledge retrieval.

---

```text
Agent Tool
    ↓
NestJS
```

Business tools call NestJS APIs rather than directly modifying PostgreSQL.

---

```text
RAG Service
    ↓
Vector Database
```

The RAG Service owns vector database operations.

---

# 14. Main V1 Runtime Flows

## 14.1 Document Upload

```text
User / Client
      ↓
NestJS
      ↓
Documents Module
      ↓
Object Storage
      ↓
PostgreSQL document record
      ↓
RAG Service
      ↓
Extract → Chunk → Embed
      ↓
Vector Database
```

---

## 14.2 Chat and Agent

```text
User / Client
      ↓
NestJS
      ↓
Store user message
      ↓
Agent Service
      ↓
LLM
      ↓
Tool required?
```

If no:

```text
Agent
  ↓
Final response
  ↓
NestJS
  ↓
Store assistant message
  ↓
User / Client
```

If yes:

```text
Agent
  ↓
Tool
  ↓
NestJS or RAG Service
  ↓
Tool result
  ↓
Agent
  ↓
LLM
  ↓
Continue loop
```

---

## 14.3 Knowledge Search

```text
Agent
  ↓
search_knowledge
  ↓
RAG Service
  ↓
Embed query
  ↓
Vector search
  ↓
Filter by user / MindSpace
  ↓
Top chunks + scores
  ↓
Agent
```

---

## 14.4 Agent Business Action

Example: creating a task.

```text
Agent
  ↓
create_task
  ↓
NestJS
  ↓
Task Module
  ↓
Validation / Authorization
  ↓
PostgreSQL
  ↓
Result
  ↓
Agent
```

---

# 15. Ownership Summary

## NestJS Owns

- Authentication
- Authorization
- Application business logic
- User ownership
- MindSpaces
- Conversations
- Messages
- Notes
- Tasks
- Documents
- PostgreSQL
- Object storage lifecycle
- Application orchestration

## AI Agent Service Owns

- LLM interaction
- Agent reasoning loop
- Tool registry
- Tool selection
- Tool execution orchestration
- Maximum execution steps
- Final agent response

## Knowledge / RAG Service Owns

- Text extraction
- Chunking
- Embeddings
- Vector storage
- Semantic retrieval
- Similarity scoring
- Vector database interaction

---

# 16. V1 Boundary

The high-level architecture for V1 is intentionally simple.

V1 does not require:

- Frontend-specific architecture
- Automation engine
- Event-driven workflows
- Scheduled jobs
- Gmail integration
- Calendar integration
- Multi-agent architecture
- Nested MindSpaces
- Knowledge graph

These can be introduced later without changing the main V1 service boundaries.

---

# 17. Final High-Level View

```text
                         ┌──────────────────────┐
                         │    User / Client     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   NestJS Backend     │
                         │                      │
                         │ Auth                 │
                         │ MindSpaces           │
                         │ Conversations        │
                         │ Notes                │
                         │ Tasks                │
                         │ Documents            │
                         └───┬────────┬─────────┘
                             │        │
                    ┌────────┘        └────────────┐
                    ▼                             ▼
          ┌───────────────────┐         ┌─────────────────────┐
          │ PostgreSQL        │         │ Object Storage      │
          └───────────────────┘         └─────────────────────┘

                             │
                    ┌────────┴─────────┐
                    ▼                  ▼
          ┌───────────────────┐   ┌────────────────────────┐
          │ AI Agent Service  │   │ Knowledge / RAG       │
          │ Python            │   │ Service - Python      │
          │                   │   │                        │
          │ LLM               │   │ Ingestion              │
          │ Agent Loop        │   │ Embeddings             │
          │ Tool Registry     │   │ Retrieval              │
          └─────────┬─────────┘   └──────────┬─────────────┘
                    │                        │
                    └──────────────►─────────┘
                       Knowledge Tool        │
                                             ▼
                                   ┌───────────────────┐
                                   │ Vector Database   │
                                   └───────────────────┘
```

This architecture is the baseline for Priora MindCloud V1.
