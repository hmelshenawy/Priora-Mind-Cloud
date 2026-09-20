# T020 — Implement Embeddings

## Phase
Phase 8 — Knowledge / RAG Service

## Goal
Add embedding generation to the RAG ingestion flow.

Current flow:

```text
storageKey
→ download PDF
→ extract text
→ chunk text
```

After this ticket:

```text
storageKey
→ download PDF
→ extract text
→ chunk text
→ embed chunks
→ return small ingestion status
```

This ticket stops at vectors. Do not store vectors in Qdrant yet.

## Scope

Implement a small embedding component that:

- loads one embedding model
- accepts `list[str]` chunks
- generates one vector per chunk
- preserves chunk/vector order
- returns vectors for the next ingestion step
- keeps the model loaded and reusable between requests

Use the project embedding model:

```text
BAAI/bge-m3
```

## Suggested Structure

Use the existing package:

```text
src/
└── ragcore/
    ├── __init__.py
    ├── main.py
    ├── config.py
    ├── storage.py
    ├── pdfExtractor.py
    ├── chunker.py
    └── embedder.py
```

Suggested class:

```python
class Embedder:
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...
```

Do not create provider interfaces, factories, adapters, or generic embedding abstractions.

## Embedding Library

Use `sentence-transformers`.

The model should be loaded once when the embedding component is created, not once per chunk.

Example responsibility:

```text
Embedder
├── load model
└── texts → vectors
```

## Configuration

Add only configuration required by this ticket.

Example:

```env
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_BATCH_SIZE=32
```

Use sensible defaults if that matches the existing config style.

## Behavior

Input:

```python
[
    "first chunk...",
    "second chunk...",
]
```

Output:

```python
[
    [0.012, -0.034, ...],
    [0.041, 0.008, ...],
]
```

Requirements:

- one vector per input chunk
- output order matches input order
- empty input returns `[]`
- vectors are plain Python lists of floats
- embeddings should be normalized if supported by the selected model/library
- process chunks in batches rather than one model call per chunk

## Ingestion Flow

Update `/v1/ingest`:

```text
POST /v1/ingest
    ↓
download PDF
    ↓
extract text
    ↓
chunk text
    ↓
embed chunks
    ↓
keep vectors internal
    ↓
return small status
```

Do not return all vectors in the HTTP response.

Example response:

```json
{
  "status": "embedded",
  "chunkCount": 12,
  "vectorCount": 12
}
```

## Important Rules

The embedder should only know:

```text
text → vector
```

It should not know about:

- PDF files
- Supabase
- storage keys
- Qdrant
- users
- MindSpaces
- Documents

Keep responsibilities separate:

```text
PdfExtractor: bytes → text
Chunker:      text → chunks
Embedder:     chunks → vectors
```

## Error Handling

Fail clearly if:

- model cannot be loaded
- embedding generation fails
- configuration is invalid

Do not introduce a large custom exception framework.

## Acceptance Criteria

- `sentence-transformers` is added as a dependency.
- `BAAI/bge-m3` is used by default.
- An embedding component exists.
- It accepts `list[str]`.
- It returns `list[list[float]]`.
- One vector is generated per chunk.
- Input/output order is preserved.
- Empty input returns an empty list.
- Model is not reloaded for every chunk.
- Batch embedding is used.
- `/v1/ingest` performs extraction → chunking → embedding.
- `/v1/ingest` returns only a small status response.
- No Qdrant integration is implemented.
- No semantic search is implemented.
- Relevant checks/tests pass.

## Out of Scope

Do NOT implement:

- Qdrant
- vector storage
- collection creation
- vector payloads
- `/search`
- semantic retrieval
- reranking
- query rewriting
- PostgreSQL access
- document status updates
- Agent integration
- multiple embedding providers
- OpenAI embeddings
- embedding factories
- provider interfaces
- background jobs
- queues

## Implementation Rules

- Keep it simple.
- One embedding implementation only.
- Load the model once and reuse it.
- Prefer direct code over unnecessary abstractions.
- Do not build provider architecture.
- Keep source files small and readable.
- Follow the existing `ragcore` package structure.

## Validation

Before completing the ticket:

1. Embed one short string.
2. Confirm one vector is returned.
3. Embed multiple chunks.
4. Confirm vector count equals chunk count.
5. Confirm every vector has the same dimension.
6. Confirm empty input returns `[]`.
7. Run `/v1/ingest` using the existing RAG test PDF.
8. Confirm HTTP 200 with matching `chunkCount` and `vectorCount`.
9. Run relevant lint/type/test checks.

## Completion Report

When finished, report:

1. Files created.
2. Files modified.
3. Dependencies added.
4. Configuration added.
5. What was implemented.
6. Validation results.
7. Any deviation from this ticket and why.
