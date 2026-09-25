# Data Model: Conversations and Chat

NestJS remains the source of truth. All frontend data below is request-scoped local state.

## Conversation

- `id`: stable conversation identifier.
- `mindSpaceId`: owning MindSpace identifier.
- `title`: user-provided title.
- `createdAt`: backend creation timestamp.
- `updatedAt`: backend update timestamp.

Rules:

- A conversation is usable only when its `mindSpaceId` matches the current MindSpace.
- New titles are trimmed and must contain at least three characters.
- List order follows the backend response, currently newest updated first.

## Message

- `id`: stable message identifier.
- `conversationId`: owning conversation identifier.
- `role`: `USER` or `ASSISTANT` as returned by NestJS.
- `content`: message text.
- `createdAt`: backend creation timestamp.

Rules:

- Display messages in the backend's chronological order.
- Trim outgoing content and reject empty content.
- Persisted message state is refreshed from NestJS after sending.

## Agent Reply

Current message-send response fields consumed by the frontend:

- `role`: assistant role.
- `content`: assistant response text.

The reply confirms send success but is not treated as a complete persisted message record because it lacks the full stored message identity/timestamps.

## Local Chat State

- `mindSpaceId`: current prop from AppShell.
- `conversations`: latest list for that MindSpace.
- `activeConversationId`: selected conversation or null.
- `messages`: latest history for the active conversation.
- `newConversationTitle`: controlled creation input.
- `messageContent`: controlled composer input.
- request statuses/errors for list, create, message load, and send.

## State Transitions

```text
MindSpace changes -> clear all chat state -> load conversations
Conversation selected -> clear messages -> load chronological history
Conversation created -> add/open conversation -> load history
Message submitted -> sending -> success -> reload history
Message submitted -> sending -> error -> preserve composer content
Unauthorized -> clear auth/MindSpace selection -> login
```
