# T017 --- Initialize Knowledge / RAG Service

## Phase

Phase 8 --- Knowledge / RAG Service

## Goal

Create the initial standalone Python/FastAPI Knowledge / RAG service
that will later own document ingestion and semantic retrieval.

This ticket is foundation only. Do not implement PDF extraction,
chunking, embeddings, Qdrant, or search yet.

## Scope

Create a new Python service with: - FastAPI application - Basic
project/package structure - Environment-based configuration - Health
endpoint - Local development run command - Minimal dependency setup

Keep the implementation simple and ready for the next RAG tickets.

## Service Responsibility

``` text
Ingestion:
Document → Extract → Clean → Chunk → Embed → Qdrant

Retrieval:
Query → Embed → Qdrant Search → Relevant Chunks
```

T017 implements only the service foundation.

## Suggested Structure

``` text
rag-service/
├── pyproject.toml
├── .env.example
└── src/
    └── priora_rag/
        ├── __init__.py
        ├── main.py
        └── config.py
```

A different small structure is acceptable if it follows existing
repository conventions. Do not create future modules before they are
needed.

## API

### GET /health

Returns HTTP 200:

``` json
{
  "status": "ok"
}
```

No authentication or NestJS integration is required in this ticket.

## Configuration

-   Use environment variables.
-   Add only variables currently required to run the service.
-   Provide `.env.example` without secrets.
-   Do not add Supabase, embedding-model, or Qdrant configuration yet.

## Acceptance Criteria

-   Standalone Python RAG service exists.
-   FastAPI starts successfully.
-   `GET /health` returns HTTP 200 with healthy response.
-   Configuration is environment-based.
-   `.env.example` contains no secrets.
-   Dependencies are declared.
-   Local run command is clear.
-   Code is small and readable.

## Out of Scope

Do NOT implement: - PDF download - Supabase Storage integration - PDF
extraction - text cleaning - chunking - embeddings - Qdrant - vector
storage - semantic search - `/ingest` - `/search` - NestJS integration -
Agent integration - background jobs / queues - authentication - generic
provider abstractions - repositories - factories - unnecessary
interfaces/base classes

## Implementation Rules

-   Keep it minimal.
-   Do not over-engineer.
-   No abstractions for hypothetical future providers.
-   No class when a simple function/module is sufficient.
-   No one-use helper when inline code is clearer.
-   Follow existing repository conventions.
-   Add only dependencies required by T017.

## Validation

1.  Start the FastAPI service.
2.  Call `GET /health`.
3.  Confirm HTTP 200 and expected response.
4.  Run configured checks relevant to the service.

## Completion Report

Report: 1. Files created. 2. Files modified. 3. What was implemented. 4.
Validation results. 5. Any deviation from the ticket and why.
