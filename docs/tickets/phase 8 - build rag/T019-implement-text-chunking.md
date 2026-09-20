# T019 — Implement Text Chunking

## Phase
Phase 8 — Knowledge / RAG Service

## Goal
Add text chunking to the RAG ingestion flow.

Current flow:

```text
storageKey
→ download PDF
→ extract text
```

After this ticket:

```text
storageKey
→ download PDF
→ extract text
→ chunk text
→ return small ingestion status
```

This ticket stops at chunks. Do not implement embeddings, Qdrant, or semantic search yet.

## Scope

Implement a small chunking component that:

- accepts extracted text as `str`
- splits it into manageable chunks
- supports configurable chunk size
- supports configurable chunk overlap
- removes empty chunks
- preserves chunk order
- returns chunks for the next ingestion step

Keep the implementation simple and deterministic.

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
    └── chunker.py
```

Suggested class:

```python
class Chunker:
    def chunk(self, text: str) -> list[str]:
        ...
```

A simple function is also acceptable if it keeps the code clearer.

Do not create interfaces, factories, providers, or generic chunking abstractions.

## Chunking Strategy

Use simple character-based chunking for V1.

Example:

```text
CHUNK_SIZE=1000
CHUNK_OVERLAP=150
```

Meaning:

```text
chunk 1 → chars 0..999
chunk 2 → chars 850..1849
chunk 3 → chars 1700..2699
```

The overlap helps preserve context between adjacent chunks.

Do not add tokenizers or model-specific token counting in this ticket.

## Configuration

Add:

```env
CHUNK_SIZE=1000
CHUNK_OVERLAP=150
```

Rules:

- `CHUNK_SIZE` > 0
- `CHUNK_OVERLAP` >= 0
- `CHUNK_OVERLAP` < `CHUNK_SIZE`

Use sensible defaults if that matches the existing config style.

## Behavior

The chunker should return:

```python
[
    "chunk 1 text...",
    "chunk 2 text...",
    "chunk 3 text...",
]
```

Requirements:

- preserve source order
- strip surrounding whitespace from each chunk
- do not return empty strings
- short text returns one chunk
- empty/whitespace-only text returns `[]`
- overlap must not cause an infinite loop

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
keep chunks internal
    ↓
return small status
```

Do not return all extracted text or all chunks.

Example response:

```json
{
  "status": "chunked",
  "chunkCount": 4
}
```

## Error Handling

Invalid chunk configuration must fail clearly.

Do not silently allow:

```text
chunk_size <= 0
chunk_overlap < 0
chunk_overlap >= chunk_size
```

Do not add a custom exception framework.

## Acceptance Criteria

- A chunking component exists.
- It accepts extracted text and returns `list[str]`.
- Chunk size is configurable.
- Chunk overlap is configurable.
- Chunk order is preserved.
- Empty chunks are removed.
- Short text returns one chunk.
- Empty text returns an empty list.
- Invalid chunk configuration fails clearly.
- `/v1/ingest` now performs PDF extraction followed by chunking.
- `/v1/ingest` returns only a small status response.
- No embeddings are implemented.
- No Qdrant integration is implemented.
- No semantic search is implemented.
- Relevant checks/tests pass.

## Out of Scope

Do NOT implement:

- embeddings
- embedding model loading
- token-based chunking
- model-specific token counting
- semantic chunking
- recursive chunking frameworks
- LangChain
- LlamaIndex
- Qdrant
- vector storage
- `/search`
- document status updates
- PostgreSQL access
- Agent integration
- background jobs
- queues
- generic chunking strategies
- factories
- unnecessary interfaces/base classes

## Implementation Rules

- Keep it simple.
- Prefer direct code.
- One chunker implementation only.
- No abstraction for hypothetical future chunkers.
- Avoid unnecessary helper functions.
- Keep source files small and readable.
- Follow the existing `ragcore` package structure.

## Validation

Before completing the ticket:

1. Test text shorter than `CHUNK_SIZE`.
2. Test long text producing multiple chunks.
3. Confirm overlap between adjacent chunks.
4. Test empty text.
5. Test invalid chunk configuration.
6. Run `/v1/ingest` with the existing RAG test PDF.
7. Confirm HTTP 200 and a reasonable `chunkCount`.
8. Run relevant lint/type/test checks.

## Completion Report

When finished, report:

1. Files created.
2. Files modified.
3. Configuration added.
4. What was implemented.
5. Validation results.
6. Any deviation from this ticket and why.
