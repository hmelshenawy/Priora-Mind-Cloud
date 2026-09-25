# Contract: Conversations And Messages

All requests use the existing bearer access token and NestJS API base URL. No request sends `userId`.

## List Conversations

- Method: `GET`
- Path: `/api/v1/conversations?minspaceId=<mindSpaceId>`
- Response: existing conversation array, ordered by `updatedAt` descending

The `minspaceId` spelling is the current controller contract.

## Create Conversation

- Method: `POST`
- Path: `/api/v1/conversations`
- Body:

```json
{
  "title": "Conversation title",
  "mindSpaceId": "mindspace-id"
}
```

- Validation: title required, minimum three characters; `mindSpaceId` must be a UUID owned by the authenticated user
- Response: created conversation record

## List Messages

- Method: `GET`
- Path: `/api/v1/conversations/:conversationId/messages`
- Response: existing message array ordered by `createdAt` ascending

## Send Message

- Method: `POST`
- Path: `/api/v1/conversations/:conversationId/messages`
- Body:

```json
{
  "content": "User message"
}
```

- Validation: non-empty string
- Behavior: NestJS validates ownership, persists user content, calls Agent internally, persists assistant content, and returns the Agent reply
- Current response consumed by frontend:

```json
{
  "role": "assistant",
  "content": "Assistant response"
}
```

After success, the frontend reloads message history instead of manufacturing persisted message records.

## Error Contract

- Unauthorized: clear existing frontend auth and MindSpace selection, then redirect to locale login.
- Not found/ownership failure: show a safe context error or reset the no-longer-valid active conversation.
- Network/server failure: show a translated safe error without raw backend details.

## Boundary Rules

- Frontend calls NestJS only.
- Frontend does not send `userId`.
- Frontend does not call Agent, RAG, Qdrant, PostgreSQL, Supabase, storage, or other internal services.
