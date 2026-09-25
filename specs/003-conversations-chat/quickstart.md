# Quickstart: Conversations And Chat

## Prerequisites

- Existing authentication and MindSpace selection work.
- NestJS and its Agent integration are available.
- The authenticated user has access to at least one MindSpace.

## Manual Validation

1. Open the app while logged out and confirm existing login redirect behavior.
2. Log in, select a MindSpace, and confirm its conversations load using the existing `minspaceId` filter contract.
3. Confirm an empty conversation list shows a clear empty state.
4. Create a conversation with a valid title and confirm it is added and opened.
5. Try a title shorter than three characters and confirm no request is sent.
6. Open an existing conversation and confirm messages appear chronologically with user/assistant distinction.
7. Open a conversation with no messages and confirm the message empty state.
8. Submit whitespace-only content and confirm no request is sent.
9. Send a valid message and confirm duplicate submission is disabled while sending.
10. Confirm the same conversation remains active and the reloaded history contains the persisted user and assistant messages.
11. Change MindSpace and confirm prior conversation, messages, composer, and errors clear before the new list loads.
12. Change MindSpace or conversation during a delayed request and confirm stale results do not overwrite the new context.
13. Simulate list/create/load/send failures and confirm safe translated errors.
14. Simulate unauthorized response and confirm auth/MindSpace state clears and login redirect occurs.
15. Confirm logout still works.
16. Repeat in English LTR and Arabic RTL using keyboard-only interaction and desktop/mobile widths.

## Automated Validation

Run from `frontend/`:

```bash
npm run typecheck
npm run build
```

Use existing test tooling only if it exists at implementation time. Do not add a test framework.
