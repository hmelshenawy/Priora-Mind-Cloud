# T038 --- Event Memory Persistence Service

## Phase

Event Memory

## Goal

Implement the backend persistence service for Event Memory inside the
existing `MemoryModule`.

T037 already introduced the `Event` Prisma model and database migration.
This ticket adds the application layer required to persist structured
Events safely.

## Scope

### 1. Add `EventMemoryService`

Create a dedicated service inside the existing Memory module.

``` text
MemoryModule
├── MemoryService
└── EventMemoryService
```

Suggested structure:

``` text
memory/
├── memory.service.ts
├── event-memory.service.ts
└── dto/
    └── create-event.dto.ts
```

Do not create a separate NestJS module for Event Memory.

### 2. Create Event DTO

Create a DTO representing the structured Event data required for
persistence.

Event data includes:

-   `summary`
-   `occurredAt` (optional)
-   `entities`
-   `participants`
-   `concepts`
-   `salience`
-   `embedding`

The DTO must use the project's existing `class-validator` /
`class-transformer` validation approach.

The embedding must contain exactly 1024 numeric values.

### 3. MindSpace Ownership Validation

Before storing an Event, verify that the supplied MindSpace belongs to
the authenticated user.

Conceptually:

``` ts
const mindSpace = await prisma.mindSpace.findFirst({
  where: {
    id: mindSpaceId,
    userId,
  },
});

if (!mindSpace) {
  throw new NotFoundException("MindSpace Not Found");
}
```

Never trust a user ID supplied by an LLM or external payload. Ownership
context must come from the authenticated application flow.

### 4. Persist Event

Implement Event creation in `EventMemoryService`.

Because `embedding` is a PostgreSQL `vector(1024)` represented in Prisma
as `Unsupported("vector(1024)")`, follow the same raw-SQL persistence
pattern already used by the existing semantic Memory implementation.

Persist:

-   authenticated `userId`
-   validated `mindSpaceId`
-   structured Event fields
-   embedding
-   timestamps

### 5. Register Service

Register and expose `EventMemoryService` through the existing
`MemoryModule` as required by the application architecture.

## Example Input

``` json
{
  "summary": "User completed a technical interview for an AI Engineer role at Microsoft",
  "occurredAt": "2026-09-25T00:00:00Z",
  "entities": ["Microsoft", "AI Engineer"],
  "participants": [
    {
      "entity": "user",
      "role": "candidate"
    },
    {
      "entity": "Microsoft",
      "role": "employer"
    }
  ],
  "concepts": [
    "career",
    "job interview",
    "technical interview"
  ],
  "salience": 0.82,
  "embedding": [0.01, 0.02]
}
```

The example embedding above is abbreviated for readability. Runtime
validation requires exactly 1024 values.

## Out of Scope

Do not implement in T038:

-   LLM Event Extraction
-   Conversation-context extraction
-   Unified Memory/Event extractor
-   Salience threshold decision logic
-   Event semantic search or retrieval
-   Event deduplication
-   Dynamic episode reconstruction
-   Concept normalization
-   Concept tables or embeddings
-   Episode persistence
-   Event extraction from chat messages

## Acceptance Criteria

-   `EventMemoryService` exists inside the existing `MemoryModule`.
-   `CreateEventDto` validates Event input.
-   Embedding validation requires exactly 1024 numeric values.
-   MindSpace ownership is checked using authenticated `userId`.
-   Invalid/non-owned MindSpaces are rejected.
-   Events can be persisted successfully to the existing `Event` table.
-   `vector(1024)` persistence follows the established raw-SQL pattern.
-   Existing semantic Memory behavior is unchanged.
-   No `Episode` model or persistence is introduced.
