# T022 — Implement Semantic Search

## Phase
Phase 8 — Knowledge / RAG Service

## Goal
Implement semantic retrieval from Qdrant.

Current ingestion flow:

```text
PDF
→ extract pages
→ chunk
→ embed chunks
→ store points in Qdrant
```

After this ticket:

```text
query
→ embed query
→ search Qdrant
→ return relevant chunks
```

This ticket completes the retrieval side of Phase 8.

## Scope
Implement a search endpoint that:
- accepts a text query
- validates the query
- embeds the query using the existing embedding model
- searches the existing Qdrant collection
- returns the top relevant chunks
- includes useful chunk metadata

Do not call an LLM in this ticket.

## API

### POST /v1/search

Request:

```json
{
  "query": "What evidence weakened Maya's catastrophic prediction?",
  "topK": 5
}
```

Response example:

```json
{
  "results": [
    {
      "score": 0.82,
      "text": "After the presentation, Maya records zero negative comments...",
      "sourceId": "document-id",
      "chunkIndex": 14,
      "pageNumber": 2
    }
  ]
}
```

## Search Flow

```text
POST /v1/search
    ↓
validate query
    ↓
embed query
    ↓
query vector
    ↓
Qdrant similarity search
    ↓
top matching points
    ↓
map payload + score
    ↓
return results
```

## Embedding Rules

Use the same embedding model used during ingestion:

```text
BAAI/bge-m3
```

The query vector must match the existing embedding dimension:

```text
1024
```

Reuse the existing embedding component. Do not load a second model or create a separate query embedding implementation.

## Qdrant Search

Extend the existing `QdClient` with one small search method.

Suggested shape:

```python
def search(
    self,
    collection_name: str,
    query_vector: list[float],
    limit: int,
):
    ...
```

Reuse the existing collection and cosine configuration.

Do not create another Qdrant client class.

## Result Mapping

Return only useful retrieval data.

At minimum:

```text
score
text
source_id
chunk_index
```

If already present in payload, also return:

```text
page_number
```

Do not return raw vectors.

## Validation

- `query` must be a non-empty string.
- `topK` must be greater than 0.
- Use a sensible default such as 5.
- Query vector dimension must match the configured embedding dimension.

Keep validation direct.

## Error Handling

Fail clearly when:
- query is empty
- `topK` is invalid
- embedding generation fails
- Qdrant search fails
- collection is unavailable

Do not leak provider secrets.

## Acceptance Criteria

- `POST /v1/search` exists.
- It accepts a non-empty query.
- It supports `topK`.
- Query uses the existing Embedder.
- Query vector dimension matches ingestion vectors.
- Qdrant semantic search executes successfully.
- Results are ordered by relevance.
- Each result includes score.
- Each result includes text.
- Each result includes `source_id`.
- Each result includes `chunk_index`.
- `page_number` is returned when present.
- Raw vectors are not returned.
- No LLM is called.
- No PostgreSQL access is introduced.
- Relevant checks/tests pass.

## Out of Scope

Do NOT implement:
- LLM answer generation
- prompt construction
- final citation formatting
- reranking
- query rewriting
- hybrid search
- BM25
- multi-query retrieval
- Agent integration
- NestJS integration
- PostgreSQL access
- conversation history
- authorization logic
- background jobs
- queues
- multiple vector databases
- generic search provider interfaces
- factories
- unnecessary abstractions

## Implementation Rules

- Reuse the existing `Embedding` component.
- Reuse the existing `QdClient`.
- Keep search logic small and direct.
- Do not build a retrieval framework.
- Do not introduce LangChain or LlamaIndex.
- Prefer one clear Qdrant search method.
- Follow the existing `ragcore` package structure.

## Validation

Before completing the ticket:

1. Start the RAG service.
2. Confirm the test PDF is already ingested.
3. Call `POST /v1/search` with:

```text
What evidence weakened Maya's catastrophic prediction?
```

4. Confirm relevant chunks are returned.
5. Test:

```text
What is the unique test code?
```

6. Confirm results contain score and text.
7. Confirm vectors are not returned.
8. Test empty query.
9. Test invalid `topK`.
10. Run relevant checks.

## Completion Report

When finished, report:

1. Files created.
2. Files modified.
3. What was implemented.
4. Search validation results.
5. Example query and top returned result.
6. Any deviation from this ticket and why.
