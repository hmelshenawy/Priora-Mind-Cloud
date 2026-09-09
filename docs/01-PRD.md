# Priora MindCloud — Product Requirements Document (PRD)

## 1. Product Overview

**Product Name:** Priora MindCloud  
**Version:** V1  
**Product Type:** Personal AI knowledge and productivity assistant

Priora MindCloud is a personal AI assistant designed to act as a searchable and actionable extension of the user's mind.

The user can create **MindSpaces** to organize different areas of life such as work, learning, personal interests, relationships, or any custom topic.

Inside each MindSpace, the user can:

- Chat with an AI agent.
- Upload and store files.
- Search and ask questions about uploaded knowledge.
- Create notes.
- Create and manage tasks.
- Allow the AI agent to use tools to retrieve information and perform supported actions.

Priora MindCloud combines structured application data, semantic knowledge retrieval, file storage, and AI-agent capabilities in one system.

---

## 2. Product Vision

Priora MindCloud should become a personal digital extension of the user's mind.

The product should help the user:

- Capture information.
- Organize knowledge.
- Remember previously stored information.
- Retrieve knowledge naturally through conversation.
- Manage tasks and notes.
- Let an AI agent perform supported actions on the user's behalf.

The long-term vision is:

> **Capture → Understand → Remember → Connect → Act**

---

## 3. Problem Statement

People store information across many disconnected places:

- Notes
- PDFs
- Articles
- Screenshots
- Chat conversations
- Tasks
- Personal projects
- Work documents

Traditional file systems store information but do not understand it.

Traditional chat assistants can answer questions but do not naturally organize and operate on a persistent personal knowledge system.

Priora MindCloud combines both approaches.

It provides:

1. Structured personal organization through MindSpaces.
2. Persistent application data such as tasks, notes, chats, and documents.
3. Semantic knowledge retrieval through RAG.
4. An AI agent capable of using tools to interact with the user's data.

---

## 4. Target User

V1 is primarily designed for a single individual who wants a personal AI assistant for:

- Learning
- Work
- Personal knowledge
- Notes
- Tasks
- Documents
- AI-assisted information retrieval

The initial target user is technically comfortable and regularly works with digital knowledge and documents.

---

## 5. Core Product Concept

### 5.1 MindSpaces

A **MindSpace** represents an area of the user's mind or life.

Examples:

- Work
- Learning
- Personal
- Islamic
- Relationships
- Priora MindCloud
- AI Engineering
- Career

The user creates and manages their own MindSpaces.

V1 uses **flat MindSpaces**.

Nested MindSpaces are not included in V1.

Each MindSpace can contain:

- Conversations
- Messages
- Notes
- Tasks
- Documents
- RAG knowledge

---

## 6. Main User Experience

### 6.1 Global Application

The user logs in and sees their MindSpaces.

Example:

```text
My Mind

Work
Learning
Personal
Islamic
Priora MindCloud
```

The user selects a MindSpace to work inside its context.

---

### 6.2 MindSpace

Each MindSpace acts as a contextual workspace.

Example:

```text
Learning / AI

Chat
Notes
Tasks
Files
Knowledge
```

The AI agent should understand the current MindSpace context when responding or using tools.

---

### 6.3 Chat

The user can start conversations inside a MindSpace.

Example:

> What did I previously save about agent memory?

The AI agent can use the MindSpace's RAG knowledge and supported tools to answer.

The conversation and messages are persisted.

---

### 6.4 File Upload

The user can upload supported files to a MindSpace.

For V1, the primary supported format is:

- PDF

The original file is stored in object storage.

The file is then processed by the ingestion pipeline.

```text
Upload PDF
    ↓
Store original file
    ↓
Extract text
    ↓
Chunk text
    ↓
Generate embeddings
    ↓
Store vectors
    ↓
Document becomes searchable
```

---

### 6.5 RAG

The user can ask questions about knowledge stored inside a MindSpace.

Example:

> What does my RAG architecture document say about reranking?

The system retrieves relevant document chunks and provides them to the LLM.

RAG should be scoped to the current MindSpace by default.

---

### 6.6 Notes

The user can create notes inside a MindSpace.

Example:

```text
Title:
Agent Memory Idea

Content:
Separate semantic knowledge from operational agent memory.
```

Notes are stored in the main application database.

Future versions may allow selected notes to be embedded and added to semantic knowledge.

---

### 6.7 Tasks

The user can create and manage tasks inside a MindSpace.

Example:

```text
Finish RAG ingestion pipeline
Status: TODO
Executor: USER
```

A task may be executed by:

- USER
- AGENT

V1 focuses primarily on task creation, status management, and basic agent execution.

Scheduling and event-driven automations are future extensions unless needed by a simple V1 agent flow.

---

## 7. AI Agent

The AI agent is the primary intelligent interface of Priora MindCloud.

The agent can:

- Answer normal user questions.
- Search MindSpace knowledge.
- Retrieve notes.
- Retrieve tasks.
- Create tasks.
- Update tasks.
- Access uploaded documents through retrieval tools.
- Use supported internal tools.

The agent does not directly access databases.

The agent interacts with application functionality through defined tools.

Example:

```text
User
 ↓
Agent
 ↓
search_knowledge()
 ↓
RAG retrieval
 ↓
Agent
 ↓
Final answer
```

---

## 8. Initial Agent Tools

V1 should support a small, controlled tool set.

### Knowledge

- `search_knowledge`
- `get_document`

### Notes

- `create_note`
- `get_notes`
- `get_note`

### Tasks

- `create_task`
- `get_tasks`
- `update_task`

### MindSpaces

- `get_mindspace_context`

More tools can be introduced after the core agent loop is stable.

---

## 9. Data Storage Responsibilities

Priora MindCloud uses three primary storage layers.

### 9.1 PostgreSQL

PostgreSQL is the main application database.

It stores structured application state such as:

- Users
- MindSpaces
- Conversations
- Messages
- Notes
- Tasks
- Documents
- File metadata
- Processing status
- Agent-related structured records

PostgreSQL is **not only a metadata store**.

It is the source of truth for structured application data.

---

### 9.2 Object Storage

Object storage stores original uploaded files.

Examples:

- S3
- S3-compatible storage
- Supabase Storage

Example:

```text
documents/user_123/doc_456/original.pdf
```

The original file must be preserved independently from its vector representation.

---

### 9.3 Vector Database

The vector database stores searchable semantic representations of content.

Example technologies:

- Qdrant
- pgvector

Each document chunk should include metadata that links it back to application data.

Example:

```json
{
  "documentId": "doc_123",
  "mindSpaceId": "space_456",
  "userId": "user_789",
  "page": 14,
  "chunkIndex": 3,
  "text": "..."
}
```

---

## 10. Document Processing

Uploaded documents pass through a processing pipeline.

### Pipeline

```text
Uploaded
   ↓
Stored
   ↓
Queued / Processing
   ↓
Text extraction
   ↓
Cleaning
   ↓
Chunking
   ↓
Embedding
   ↓
Vector storage
   ↓
Ready
```

Suggested document statuses:

- UPLOADED
- PROCESSING
- READY
- FAILED

The ingestion pipeline should be designed so a document can later be reprocessed without requiring the user to upload it again.

---

## 11. AI-Generated Knowledge

Priora MindCloud may generate useful derived content from uploaded material.

Examples:

- Summary
- Key concepts
- Tags
- Important ideas

Example:

```text
Original Article / PDF
        ↓
AI processing
        ↓
Summary
Key Ideas
Concepts
Tags
```

The original source remains the source of truth.

AI-generated summaries must be treated as derived knowledge rather than replacements for the original content.

---

## 12. V1 Functional Scope

### Authentication

- User can register.
- User can log in.
- User can log out.
- Protected resources belong to the authenticated user.

### MindSpaces

- User can create a MindSpace.
- User can list MindSpaces.
- User can open a MindSpace.
- User can rename a MindSpace.
- User can delete a MindSpace.
- MindSpaces are flat in V1.

### Conversations

- User can create a conversation inside a MindSpace.
- User can list conversations.
- User can open a conversation.
- User can send messages.
- Assistant responses are persisted.

### Notes

- User can create notes.
- User can list notes by MindSpace.
- User can update notes.
- User can delete notes.

### Tasks

- User can create tasks.
- User can list tasks by MindSpace.
- User can update task status.
- User can assign execution responsibility to USER or AGENT.
- Agent can create or update tasks through tools.

### Documents

- User can upload a PDF.
- Document belongs to a MindSpace.
- Original PDF is persisted in object storage.
- Document record is persisted in PostgreSQL.
- Uploaded PDF is processed asynchronously or through a processing workflow.
- Extracted content is chunked.
- Embeddings are generated.
- Vectors are stored in the vector database.
- Processing state is visible to the user.
- Failed document processing can be retried.

### RAG

- User can ask questions about MindSpace knowledge.
- Retrieval is scoped to the authenticated user.
- Retrieval is scoped to the current MindSpace by default.
- Retrieved chunks include source information.
- Assistant answers should be grounded in retrieved context where appropriate.

### Agent

- LLM can decide when a tool is needed.
- Tool calls are validated.
- Tool results are returned to the LLM.
- Agent execution has a maximum step limit.
- Only registered tools may be executed.
- Final responses are persisted in the conversation.

---

## 13. Out of Scope for V1

The following features are intentionally excluded from V1:

- Nested MindSpaces
- Gmail integration
- Google Calendar integration
- Google Drive integration
- Proactive background assistant
- Complex recurring automations
- Event-driven automation system
- Full image understanding
- Video ingestion
- Audio ingestion
- Multimodal embeddings
- Knowledge graph
- Multi-user collaboration
- Organization/team accounts
- Complex agent memory architecture
- Advanced human-memory simulation
- Mobile application
- Browser extension
- Share-to-MindCloud mobile integration

These may be introduced in later versions.

---

## 14. Future Integrations

Potential future integrations include:

### Gmail

The user may connect Gmail and allow the agent to:

- Search messages.
- Summarize important emails.
- Retrieve attachments.
- Associate emails with MindSpaces.
- Create tasks based on emails.

### Calendar

The agent may:

- Read upcoming events.
- Create events.
- Use schedule context while helping the user plan.

### Web / Scraping

The agent may use external data acquisition tools.

Example:

```text
Scrape Dubizzle for Toyota listings
```

A Python tool may execute the scraper and return structured results to the agent.

### Automations

Future tasks may support:

```text
executor:
USER | AGENT

trigger:
MANUAL | SCHEDULED | EVENT
```

Examples:

- USER + MANUAL  
  Review RAG architecture.

- AGENT + MANUAL  
  Analyze a document now.

- AGENT + SCHEDULED  
  Search Dubizzle every morning.

- AGENT + EVENT  
  Process a new Gmail message when it arrives.

---

## 15. High-Level Technical Direction

The expected system will likely include:

```text
Frontend
   ↓
NestJS Backend
   ↓
Application Services
   ↓
PostgreSQL

        +
AI Agent Service

        +
Python AI / ingestion services

        +
Vector Database

        +
Object Storage
```

Detailed architecture decisions belong in the System Design and SAD documents, not this PRD.

---

## 16. Product Principles

### Simple First

V1 should prioritize a small working system over a large feature set.

### User-Owned Organization

MindSpaces are created and named by the user.

The system should not force a predefined structure for the user's mind.

### AI Should Add Intelligence, Not Complexity

Users should interact naturally.

They should not need to understand:

- embeddings
- vector databases
- chunking
- retrieval
- tool calling

### Preserve Original Sources

AI-generated summaries and embeddings must never replace the original user content.

### Structured Data and Semantic Knowledge Are Different

Use PostgreSQL for application state.

Use vector search where semantic retrieval provides value.

### Agent Actions Must Be Controlled

The agent should only interact with the system through registered and validated tools.

---

## 17. V1 Success Criteria

Priora MindCloud V1 is successful when a user can complete the following end-to-end flow:

```text
1. Register / login
2. Create a MindSpace
3. Upload a PDF
4. System stores the PDF
5. System processes and embeds its content
6. User opens a chat in the MindSpace
7. User asks a question about the PDF
8. Agent retrieves relevant knowledge
9. Agent answers using the retrieved context
10. User creates a note
11. User creates a task
12. Agent can retrieve or modify supported structured data through tools
```

If this workflow works reliably, the core V1 concept is validated.

---

## 18. V1 Definition

**Priora MindCloud V1 is a personal AI workspace where users organize their life into MindSpaces, store notes, tasks, conversations, and documents, and interact with that information through an AI agent backed by persistent storage and RAG.**
