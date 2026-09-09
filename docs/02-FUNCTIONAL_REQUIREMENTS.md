# Priora MindCloud — Functional Requirements

## 1. Purpose

This document defines the functional requirements for **Priora MindCloud V1**.

The goal is to describe **what the system must do**, without defining the detailed technical architecture or implementation.

---

# 2. Functional Requirement Categories

Priora MindCloud V1 is divided into the following functional areas:

1. Authentication & User
2. MindSpaces
3. Conversations
4. Notes
5. Tasks
6. Documents
7. Knowledge
   - Ingestion
   - Retrieval
8. AI Agent

---

# 3. Authentication & User

## FR-AUTH-001 — Register User

The system shall allow a new user to create an account.

The system shall:

- Accept required registration data.
- Validate the submitted data.
- Prevent duplicate accounts where applicable.
- Store the new user in the application database.

---

## FR-AUTH-002 — Login

The system shall allow a registered user to authenticate.

The system shall:

- Validate user credentials.
- Reject invalid credentials.
- Create an authenticated session or token-based authentication state.

---

## FR-AUTH-003 — Logout

The system shall allow the authenticated user to log out.

The system shall invalidate or remove the active authentication state where applicable.

---

## FR-AUTH-004 — Get Current User

The system shall allow an authenticated user to retrieve their own profile/account data.

The system must not expose another user's private account data.

---

## FR-AUTH-005 — Refresh Authentication

If token-based authentication uses access and refresh tokens, the system shall allow a valid refresh token to issue a new access token.

---

# 4. MindSpaces

## FR-MINDSPACE-001 — Create MindSpace

The authenticated user shall be able to create a MindSpace.

A MindSpace shall belong to the authenticated user.

---

## FR-MINDSPACE-002 — Get All MindSpaces

The authenticated user shall be able to retrieve all MindSpaces that belong to them.

The system shall not return MindSpaces owned by another user.

---

## FR-MINDSPACE-003 — Get MindSpace

The authenticated user shall be able to retrieve one MindSpace by its identifier.

---

## FR-MINDSPACE-004 — Update MindSpace

The authenticated user shall be able to update a MindSpace they own.

---

## FR-MINDSPACE-005 — Delete MindSpace

The authenticated user shall be able to delete a MindSpace they own.

The system shall define how related data is handled when a MindSpace is deleted.

---

# 5. Conversations

## FR-CONV-001 — Create Conversation

The authenticated user shall be able to create a conversation inside a MindSpace.

---

## FR-CONV-002 — Get All Conversations

The authenticated user shall be able to retrieve conversations belonging to a MindSpace they own.

---

## FR-CONV-003 — Get Conversation

The authenticated user shall be able to retrieve a single conversation.

---

## FR-CONV-004 — Update Conversation

The authenticated user shall be able to update supported conversation properties such as the conversation title.

---

## FR-CONV-005 — Delete Conversation

The authenticated user shall be able to delete a conversation they own.

---

## FR-CONV-006 — Send Message

The authenticated user shall be able to send a message inside a conversation.

The system shall:

- Persist the user message.
- Pass the message and relevant context to the AI agent.
- Receive the AI response.
- Persist the assistant response.
- Return the assistant response to the user.

---

## FR-CONV-007 — Get Conversation Messages

The authenticated user shall be able to retrieve the message history of a conversation they own.

---

# 6. Notes

## FR-NOTE-001 — Create Note

The authenticated user shall be able to create a note inside a MindSpace.

---

## FR-NOTE-002 — Get All Notes

The authenticated user shall be able to retrieve notes belonging to a MindSpace.

---

## FR-NOTE-003 — Get Note

The authenticated user shall be able to retrieve one note.

---

## FR-NOTE-004 — Update Note

The authenticated user shall be able to update a note they own.

---

## FR-NOTE-005 — Delete Note

The authenticated user shall be able to delete a note they own.

---

# 7. Tasks

## FR-TASK-001 — Create Task

The authenticated user shall be able to create a task inside a MindSpace.

A task may be assigned to:

- USER
- AGENT

---

## FR-TASK-002 — Get All Tasks

The authenticated user shall be able to retrieve tasks belonging to a MindSpace.

---

## FR-TASK-003 — Get Task

The authenticated user shall be able to retrieve one task.

---

## FR-TASK-004 — Update Task

The authenticated user shall be able to update task properties.

Examples include:

- Title
- Description
- Status
- Executor

---

## FR-TASK-005 — Delete Task

The authenticated user shall be able to delete a task they own.

---

## FR-TASK-006 — Update Task Status

The authenticated user or an authorized agent action shall be able to update the status of a task.

Possible statuses may include:

- TODO
- IN_PROGRESS
- DONE
- CANCELLED

---

## FR-TASK-007 — Agent Task Execution

If a task is assigned to the AGENT, the system shall allow the AI agent to execute supported actions using registered tools.

Automated scheduling is out of scope for V1.

---

# 8. Documents

## FR-DOC-001 — Upload Document

The authenticated user shall be able to upload a supported document to a MindSpace.

V1 shall primarily support:

- PDF

---

## FR-DOC-002 — Store Original File

The system shall preserve the original uploaded file in object storage.

---

## FR-DOC-003 — Create Document Record

The system shall create a document record in the application database.

The document record shall reference:

- User
- MindSpace
- Original file
- Processing status

---

## FR-DOC-004 — Get All Documents

The authenticated user shall be able to retrieve documents belonging to a MindSpace.

---

## FR-DOC-005 — Get Document

The authenticated user shall be able to retrieve document information.

---

## FR-DOC-006 — Delete Document

The authenticated user shall be able to delete a document they own.

The system shall remove or invalidate related stored knowledge where applicable.

---

## FR-DOC-007 — Get Processing Status

The authenticated user shall be able to retrieve the processing status of an uploaded document.

Suggested statuses:

- UPLOADED
- PROCESSING
- READY
- FAILED

---

## FR-DOC-008 — Retry Failed Processing

The system shall allow a failed document processing operation to be retried without requiring the user to upload the original file again.

---

# 9. Knowledge

The Knowledge module is responsible for both:

1. Ingestion
2. Retrieval

---

# 9.1 Knowledge Ingestion

## FR-KNOW-INGEST-001 — Ingest Text

The system shall be able to ingest raw text into the knowledge system.

---

## FR-KNOW-INGEST-002 — Ingest Document

The system shall be able to ingest supported uploaded documents.

---

## FR-KNOW-INGEST-003 — Extract Text

The system shall extract text from supported files when required.

---

## FR-KNOW-INGEST-004 — Chunk Content

The system shall split extracted or submitted text into smaller chunks suitable for semantic retrieval.

---

## FR-KNOW-INGEST-005 — Generate Embeddings

The system shall generate an embedding vector for each knowledge chunk.

---

## FR-KNOW-INGEST-006 — Store Vectors

The system shall store generated vectors in the configured vector database.

Each stored vector shall include enough metadata to associate the chunk with its source.

Metadata should include where applicable:

- User ID
- MindSpace ID
- Document ID
- Chunk index
- Source type
- Page number
- Original text

---

## FR-KNOW-INGEST-007 — Replace Existing Knowledge

The system shall support replacing or reprocessing existing knowledge for the same source when necessary.

---

# 9.2 Knowledge Retrieval

## FR-KNOW-SEARCH-001 — Search Knowledge

The system shall allow semantic search over stored knowledge.

---

## FR-KNOW-SEARCH-002 — Embed Search Query

The system shall generate an embedding for the incoming search query.

---

## FR-KNOW-SEARCH-003 — Similarity Search

The system shall compare the query embedding against stored vectors.

---

## FR-KNOW-SEARCH-004 — Return Similarity Scores

The system shall return a similarity score for retrieved knowledge results.

---

## FR-KNOW-SEARCH-005 — Return Top Results

The system shall return the most relevant knowledge chunks according to the configured retrieval strategy.

---

## FR-KNOW-SEARCH-006 — Scope Search by User

Knowledge retrieval shall only search data belonging to the authenticated user.

---

## FR-KNOW-SEARCH-007 — Scope Search by MindSpace

When a MindSpace context is active, knowledge retrieval shall support filtering results to that MindSpace.

---

## FR-KNOW-SEARCH-008 — Return Source Metadata

Retrieved results shall include sufficient metadata to identify the source of the retrieved content.

---

# 10. AI Agent

## FR-AGENT-001 — Run Agent

The system shall allow an authenticated user request to trigger an AI agent run.

---

## FR-AGENT-002 — Receive User Input

The agent shall receive the current user message.

---

## FR-AGENT-003 — Receive Context

The agent shall receive relevant context where required.

Context may include:

- Conversation history
- Current MindSpace
- User identity/context
- Available tools

---

## FR-AGENT-004 — Call LLM

The agent shall send the current message state to the configured language model.

---

## FR-AGENT-005 — Tool Selection

The language model shall be able to decide whether a registered tool is required.

---

## FR-AGENT-006 — Execute Registered Tool

The agent shall execute a requested tool only if the tool exists in the tool registry.

---

## FR-AGENT-007 — Validate Tool Arguments

The system shall validate tool arguments before tool execution.

---

## FR-AGENT-008 — Return Tool Result to LLM

After tool execution, the agent shall append the tool result to the current agent message state.

---

## FR-AGENT-009 — Continue Agent Loop

The agent shall call the language model again after receiving a tool result.

The process may repeat until a final response is produced.

---

## FR-AGENT-010 — Support Multiple Tool Calls

The agent shall support multiple tool calls during a single agent run when required.

---

## FR-AGENT-011 — Maximum Steps

The agent shall enforce a maximum number of execution steps.

This prevents infinite tool-calling loops.

---

## FR-AGENT-012 — Final Response

When no additional tool execution is required, the agent shall return a final response to the calling application.

---

## FR-AGENT-013 — Persist Final Assistant Message

When the agent is used inside a conversation, the final assistant response shall be persisted as a conversation message.

Intermediate reasoning and internal tool execution steps do not need to be stored as normal user-visible conversation messages.

---

# 11. V1 Functional Boundary

Priora MindCloud V1 includes:

- Authentication
- User account access
- MindSpaces
- Conversations
- Notes
- Tasks
- Documents
- PDF ingestion
- Text chunking
- Embeddings
- Vector storage
- Semantic retrieval
- Similarity scoring
- AI agent loop
- Tool calling
- Agent interaction with supported application functionality

---

# 12. Out of Scope for V1

The following are not required for V1:

- Scheduled automations
- Event-driven automations
- Conditional automations
- Gmail integration
- Calendar integration
- Google Drive integration
- Nested MindSpaces
- Complex multi-agent systems
- Multi-user collaboration
- Multimodal embeddings
- Video ingestion
- Audio ingestion
- Advanced knowledge graphs

---

# 13. V1 Core Functional Flow

The primary V1 end-to-end flow is:

```text
User authenticates
        ↓
Creates MindSpace
        ↓
Uploads PDF
        ↓
Original file is stored
        ↓
Knowledge ingestion starts
        ↓
Extract text
        ↓
Chunk
        ↓
Embed
        ↓
Store vectors
        ↓
User starts conversation
        ↓
Sends message
        ↓
Agent runs
        ↓
Agent decides whether a tool is needed
        ↓
Knowledge search tool
        ↓
Similarity search
        ↓
Relevant chunks + scores returned
        ↓
Agent continues
        ↓
Final response
        ↓
Response stored in conversation
```

---

# 14. Functional Requirement Summary

```text
Authentication & User
    register
    login
    logout
    get current user
    refresh authentication

MindSpaces
    create
    get all
    get one
    update
    delete

Conversations
    create
    get all
    get one
    update
    delete
    send message
    get messages

Notes
    create
    get all
    get one
    update
    delete

Tasks
    create
    get all
    get one
    update
    delete
    update status
    agent execution

Documents
    upload
    store original
    create record
    get all
    get one
    delete
    processing status
    retry processing

Knowledge
    ingest text
    ingest document
    extract
    chunk
    embed
    store vectors
    search
    similarity score
    top results
    user filter
    MindSpace filter

AI Agent
    receive request
    call LLM
    detect tool call
    execute registered tool
    append tool result
    continue loop
    enforce max steps
    return final response
```
