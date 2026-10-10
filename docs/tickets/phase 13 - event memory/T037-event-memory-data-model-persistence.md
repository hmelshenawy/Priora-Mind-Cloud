# T037 --- Event Memory Data Model & Persistence

## Phase

Event Memory

## Goal

Add the persistence foundation for Event Memory inside the existing
`MemoryModule`.

Events are stored independently. There is no `Episode` model or
`episodeId`. Episodes will be reconstructed dynamically later from
related events.

## Scope

### 1. Add Prisma `Event` model

V1 fields:

-   `id`
-   `userId`
-   `mindSpaceId`
-   `summary`
-   `occurredAt` (optional)
-   `entities` (`Json`)
-   `participants` (`Json`)
-   `concepts` (`Json`)
-   `salience` (`Float`)
-   `embedding` (`vector(1024)`)
-   `createdAt`
-   `updatedAt`

``` prisma
model Event {
  id           String   @id @default(uuid())
  userId       String
  mindSpaceId  String

  summary      String
  occurredAt   DateTime?
  entities     Json
  participants Json
  concepts     Json
  salience     Float

  embedding    Unsupported("vector(1024)")

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId, mindSpaceId])
  @@index([occurredAt])
}
```

Add `User` and `MindSpace` relations following the existing project
conventions.

### 2. Create Prisma migration

Create and apply the migration for the new `Event` table, including the
`vector(1024)` embedding column.

### 3. Add `EventMemoryService`

Keep Event Memory inside the existing `MemoryModule`.

``` text
MemoryModule
├── MemoryService          # existing semantic memory
└── EventMemoryService     # new event persistence service
```

The service should initially support storing an Event and validate that
the target MindSpace belongs to the authenticated user.

## Example Event

``` json
{
  "summary": "User completed a technical interview for an AI Engineer role at Microsoft",
  "occurredAt": "2026-09-25T00:00:00Z",
  "entities": ["Microsoft", "AI Engineer"],
  "participants": [
    {"entity": "user", "role": "candidate"},
    {"entity": "Microsoft", "role": "employer"}
  ],
  "concepts": ["career", "job interview", "technical interview"],
  "salience": 0.82
}
```

## Out of Scope

-   LLM Event Extraction
-   Conversation-context extraction
-   Unified Memory/Event extractor
-   Salience threshold decision logic
-   Event semantic retrieval
-   Dynamic episode reconstruction
-   Concept normalization or Concept tables
-   Event deduplication
-   `Episode` table or `episodeId`

## Acceptance Criteria

-   Prisma contains the new `Event` model.
-   Migration creates the Event persistence structure successfully.
-   Event embeddings use `vector(1024)`.
-   `EventMemoryService` exists inside `MemoryModule`.
-   An Event can be persisted with its structured fields and embedding.
-   Events are scoped to the correct user and MindSpace.
-   No Episode persistence is introduced.
-   Existing semantic Memory behavior remains unchanged.
