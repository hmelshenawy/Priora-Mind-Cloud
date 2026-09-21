# T027 — Implement RAG Search Tool

## Phase
Phase 9 — Agent Service

## Goal
Connect the Agent service to the existing RAG service through a real knowledge-search tool.

## Target Flow

```text
User
→ Agent
→ LLM
→ searchKnowledge(query)
→ RAG Service /v1/search
→ Qdrant
→ relevant chunks
→ LLM
→ final answer
```

## Existing RAG Endpoint

Use:

```text
POST /v1/search
```

Example:

```json
{
  "query": "What evidence weakened Maya's catastrophic prediction?",
  "topK": 5
}
```

## Scope

Implement:

```python
def searchKnowledge(query: str) -> str:
    ...
```

The tool should:
- call the RAG service over HTTP
- send `query` and a small default `topK`
- receive search results
- return useful context to the Agent loop
- handle unavailable/failed RAG calls clearly

Register it in the existing:
- `registered_tools`
- `tools_map`

Do not create a new tool framework.

## Configuration

Add:

```env
RAG_SERVICE_URL=http://127.0.0.1:8800
```

## Boundary

Agent Service:
```text
decides when search is needed
→ calls RAG tool
→ uses returned context
```

RAG Service:
```text
owns embeddings
owns Qdrant
owns semantic retrieval
```

The Agent must not access Qdrant directly.

## Error Handling

Handle:
- RAG unavailable
- non-200 response
- malformed response
- empty results

Keep failures simple and readable.

## Acceptance Criteria

- `RAG_SERVICE_URL` is configurable.
- `searchKnowledge` exists.
- It is registered in `registered_tools`.
- It is registered in `tools_map`.
- It calls `/v1/search`.
- Relevant chunks are returned to the Agent.
- The Agent can invoke it through the existing tool loop.
- The LLM can produce a final answer from the retrieved context.
- No direct Qdrant access exists in Agent service.
- No NestJS business tool is added.
- No new tool framework is introduced.

## Out of Scope

Do NOT implement:
- ingestion
- embeddings
- Qdrant client in Agent service
- reranking
- citation UI
- NestJS tools
- auth between services
- persistent history
- memory
- planner
- tool-call deduplication
- retry framework

## Validation

### Knowledge query
Ask a question known to exist in the indexed PDF.

Expected:

```text
User
→ Agent
→ searchKnowledge
→ RAG
→ chunks
→ LLM
→ final answer
```

### Direct chat
`Hello`

Expected: direct answer without RAG.

### RAG unavailable
Stop RAG and ask a knowledge question.

Expected: no crash; clear graceful failure.

## Completion Report

Report:
1. Files modified.
2. Dependency added, if any.
3. Configuration added.
4. RAG tool implementation.
5. Registration.
6. Example successful request.
7. Validation results.
8. Deviations, if any.
