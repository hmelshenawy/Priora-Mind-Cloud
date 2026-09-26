# Contract: Notes

All requests use the existing NestJS API base URL and `Authorization: Bearer <accessToken>`. No request sends `userId`. Responses are raw JSON records or arrays with no response envelope and no frontend normalization layer.

## Note Record

```json
{
  "id": "note-uuid",
  "mindSpaceId": "mindspace-uuid",
  "title": "Note title",
  "content": "Plain-text note content",
  "createdAt": "2026-09-26T12:00:00.000Z",
  "updatedAt": "2026-09-26T12:00:00.000Z"
}
```

## List Notes

- Method: `GET`
- Path: `/api/v1/notes?mindSpaceId=<mindSpaceId>`
- Query: `mindSpaceId` is required and parsed as a UUID.
- Response: raw `Note[]`, ordered by `updatedAt` descending.

Backend behavior:

- Derives the user from the JWT guard.
- Verifies the user owns the requested MindSpace before returning notes.
- Returns 404 when that MindSpace is not available to the authenticated user.

## Create Note

- Method: `POST`
- Path: `/api/v1/notes`
- Body:

```json
{
  "mindSpaceId": "mindspace-uuid",
  "title": "Note title",
  "content": "Plain-text note content"
}
```

- Validation: `mindSpaceId` must be a UUID; title and content must be non-empty strings. The frontend trims and rejects whitespace-only values before requesting.
- Response: raw persisted `Note` record.

Backend behavior:

- Derives the user from the JWT guard and verifies MindSpace ownership.
- Trims title and content during persistence.
- Returns the complete created record, including ID and timestamps.

The frontend uses this response directly to prepend and open the note. It does not manufacture an ID, timestamp, or response envelope and does not perform a redundant get-one request after accepted creation.

## Get One Note

- Method: `GET`
- Path: `/api/v1/notes/:id`
- Path parameter: note identifier.
- Response: raw authoritative `Note` record.

Backend behavior:

- Derives the user from the JWT guard.
- Finds the note only through a MindSpace owned by that user.
- Returns 404 when the note does not exist or is not available to the user.

The frontend calls this operation for explicit selection of an existing list item and accepts the result only while the selected note and MindSpace remain current.

## Error Contract

- `400`: invalid UUID, missing field, invalid field type, or non-whitelisted input; show translated validation/request-safe text without raw backend details.
- `401`: clear existing auth and selected MindSpace state, then redirect to the locale login route.
- `404` from list/create: show a safe current-MindSpace or creation error.
- `404` from get one: show the selected-note unavailable state and no stale note content.
- Network or other non-success response: show a translated safe error without backend details.

## Excluded Existing Routes

- `PATCH /api/v1/notes/:id`
- `DELETE /api/v1/notes/:id`

The frontend does not call these routes in SPEC-004.

## Boundary Rules

- Frontend calls NestJS only.
- Frontend sends no `userId`.
- Frontend performs no direct Agent, RAG, Qdrant, PostgreSQL, Supabase, storage, or other internal-service access.
- No generic client, proxy, response wrapper, adapter, repository, or service layer is introduced.
