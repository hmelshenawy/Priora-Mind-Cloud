# Priora Mind Cloud

*A personal AI agent and knowledge platform built around tools, retrieval, and persistent memory.*

Priora Mind Cloud is a multi-service AI application that combines conversational agents, document retrieval, long-term semantic memory, event extraction, and tool-based automation.

## Architecture

mermaid
flowchart TD
    User --> Frontend[Next.js Frontend]
    Frontend --> Backend[NestJS Backend]
    Backend --> Agent[FastAPI AI Agent]
    Backend --> DB[(PostgreSQL / pgvector)]
    Backend --> Storage[Supabase Storage]
    Backend --> Queue[Redis / BullMQ]
    Agent --> LLM[Ollama LLM]
    Agent --> RAG[FastAPI RAG Service]
    Agent --> Backend
    RAG --> Qdrant[(Qdrant)]
    RAG --> Storage


## Key Features

- AI agent with streaming responses and tool orchestration
- Retrieval-Augmented Generation for uploaded documents
- Long-term semantic memory using PostgreSQL and pgvector
- Structured event extraction from conversations
- Extensible tools and built-in/user-defined skills
- MindSpace-based organization
- Authentication, documents, notes, tasks, and conversations
- English and Arabic frontend

## Tech Stack

| Layer | Technologies |
| --- | --- |
| AI Agent | Python, FastAPI, Ollama |
| RAG | Python, Qdrant, sentence-transformers |
| Backend | NestJS, TypeScript, Prisma |
| Frontend | Next.js, React |
| Database | PostgreSQL, pgvector |
| Infrastructure | Redis, BullMQ, Supabase, Docker |

## Project Structure

text
Priora-Mind-Cloud/
├── agent-service/
├── backend/
├── frontend/
├── rag-service/
├── docs/
├── docker-compose.yml
└── docker-compose-prod.yml


## Getting Started

### Prerequisites

- Docker and Docker Compose
- PostgreSQL
- Qdrant
- Supabase configuration
- Ollama-compatible model endpoint
- Redis for background processing

Configure the service environment files:

- backend/.env.docker
- agent-service/.env.docker
- rag-service/.env.docker

Then run:

bash
docker compose up --build


The development Compose configuration exposes the frontend at http://localhost:3001, agent at http://localhost:8000, and RAG at http://localhost:8800. External services must be configured separately.

## Engineering Focus

- Modular AI and backend service architecture
- Tool calling and agent workflows
- Dedicated document ingestion and semantic retrieval
- Persistent semantic and event memory
- Asynchronous document processing
- Authentication and application data management

> *Status:* Active development. Features and deployment requirements may evolve.

---

**Built by [Haitham Mohamed Elshenawy](https://github.com/hmelshenawy)**  
AI Engineer & Backend Systems Engineer
