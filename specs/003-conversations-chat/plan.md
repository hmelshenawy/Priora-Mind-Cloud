# Implementation Plan: Conversations and Chat

**Branch**: `main` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-conversations-chat/spec.md`

## Summary

Add a focused Chat area inside the existing protected `AppShell`. Pass the current MindSpace ID directly from the shell into one `Chat` component, keep conversations, active conversation, messages, composer, and request states local to that component, and use one contract-specific API file for the four existing NestJS endpoints. Message send will show a simple sending state, submit to NestJS, then reload persisted messages because the current send response lacks persisted message IDs and timestamps. No optimistic rollback, global state, context provider, new route, proxy, or dependency is introduced.

## Technical Context

**Language/Version**: TypeScript with Next.js 16 App Router

**Primary Dependencies**: Existing React, Next.js, and next-intl dependencies only

**Storage**: Existing auth and selected MindSpace `sessionStorage`; conversation and message state remain in memory

**Testing**: Existing frontend test tooling only; none currently exists, so do not add a test framework

**Target Platform**: Web browsers on desktop and mobile

**Project Type**: Existing Next.js frontend

**Performance Goals**: One conversation-list request per MindSpace selection and one message-list request per active conversation; no polling, streaming, or prefetching

**Constraints**: NestJS-only API calls; existing bearer auth; no `userId`; no direct Agent/RAG calls; no global state, provider, generic client, new dependencies, advanced chat, or speculative synchronization

**Scale/Scope**: One current MindSpace, one active conversation, finite message history, one non-streaming send at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Simplicity: PASS. One API module and one Chat component satisfy the current scope without architecture layers.
- Readability: PASS. Contract calls are separate from UI state; `Chat` will be split only if implementation approaches 300 lines with distinct responsibilities.
- API boundary: PASS. The frontend uses only existing NestJS conversation and message endpoints; NestJS alone calls Agent.
- Backend authority: PASS. NestJS owns auth, ownership, persistence, ordering, and Agent orchestration; frontend sends no `userId`.
- User states: PASS. Conversation list, creation, messages, and sending define loading, empty, success, validation, and error behavior.
- Accessibility and responsive design: PASS. Lists, forms, textarea, and buttons use semantic labeled controls and remain usable in EN/AR, LTR/RTL, desktop, and mobile.
- Dependencies and state: PASS. No dependency, provider, context, or global state is added; chat state remains local.
- Testing: PASS. Use current typecheck/build and manual scenarios because no frontend test tooling exists.

Post-design re-check: PASS. Phase 0 and Phase 1 retain direct API functions, local state, response reloading after send, and no extra architecture.

## Project Structure

### Documentation (this feature)

```text
specs/003-conversations-chat/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── conversations-and-messages.md
└── tasks.md             # Created by /speckit.tasks, not this plan
```

### Source Code (repository root)

```text
frontend/
├── app/
│   └── globals.css
├── components/
│   ├── app-shell.tsx            # Passes current MindSpace ID to Chat
│   └── chat.tsx                 # Local conversation/message/composer state and UI
├── lib/
│   └── api/
│       └── conversations.ts     # Four direct NestJS contract functions and types
└── messages/
    ├── en.json
    └── ar.json
```

**Structure Decision**: Add one contract-specific API file and one Chat component. Reuse `AppShell`, `AuthGate`, auth state, selected MindSpace state, locale layout, and logout. Do not create a route, provider, custom hook, generic client, service layer, or extra components unless `chat.tsx` approaches 300 lines and a real presentation responsibility can be separated.

## Actual NestJS Contracts Discovered

- List conversations: `GET /api/v1/conversations?minspaceId=<mindSpaceId>`. The existing controller currently reads the query key `minspaceId`. Response is a conversation array ordered by `updatedAt` descending.
- Create conversation: `POST /api/v1/conversations` with `{title, mindSpaceId}`. Title is required with a minimum length of three. Response is the created conversation record.
- Load messages: `GET /api/v1/conversations/:conversationId/messages`. Response is a message array ordered by `createdAt` ascending.
- Send message: `POST /api/v1/conversations/:conversationId/messages` with `{content}`. NestJS validates ownership, persists the user message, calls Agent internally, persists the assistant message, and returns the Agent reply currently shaped as `{role, content}`.
- Every endpoint requires the existing bearer access token. The frontend sends no `userId` and calls no Agent/RAG endpoint.

## State Ownership

`AppShell` remains responsible for loading/selecting MindSpaces and passes `selectedId` to `Chat`. `Chat` owns only:

- conversations for the current MindSpace;
- active conversation ID;
- messages for the active conversation;
- conversation title and message composer values;
- list, create, message-load, and send statuses/errors.

No chat state is persisted or shared globally. On `mindSpaceId` change, `Chat` immediately clears active conversation, messages, inputs, and errors before requesting the new list.

## Conversation List Data Flow

1. `AppShell` renders `Chat` only when a valid selected MindSpace exists.
2. `Chat` reads the access token from existing auth state and calls `listConversations(token, mindSpaceId)`.
3. The API function uses the exact existing `minspaceId` query key and returns the backend array unchanged.
4. The component renders loading, empty, safe error, or the conversation list.
5. A changed MindSpace resets all prior chat state before loading the new list.

## Create Conversation Flow

1. User enters a title; trim and require at least three characters before requesting.
2. Disable duplicate creation while the request is active.
3. Call `createConversation(token, {title, mindSpaceId})`.
4. On success, add the returned conversation to the top of the local list, make it active, clear the title input, and load its empty/current message history.
5. On failure, keep current context and show a safe translated error.

## Active Conversation And Message Loading

- Selecting a conversation sets its ID and clears previous messages/errors before loading.
- Call `listMessages(token, conversationId)` and display the returned chronological array directly.
- User and assistant roles receive distinct semantic labels and visual styles.
- No pagination, infinite scroll, markdown, or message editing is added.

## Send Message Approach

1. Trim content; do not request when empty or while a send is active.
2. Keep the same active conversation and show a clear sending state with the submitted text remaining visible in the composer or sending region.
3. Call `sendMessage(token, conversationId, {content})` through NestJS.
4. The current response `{role, content}` does not include both persisted messages with IDs/timestamps, so do not construct speculative persisted state from it.
5. On success, clear the composer and reload `GET /conversations/:id/messages`; the reloaded backend history displays both persisted user and assistant messages.
6. On failure, preserve the composer content for correction/resubmission and show a safe error. No optimistic rollback architecture is needed.

## Stale Request Protection

- Each effect/request captures the MindSpace or conversation ID it was started for.
- Use a small request counter/ref or effect cleanup flag to ignore a result if the current MindSpace/conversation no longer matches.
- MindSpace change invalidates list, create, message-load, and send follow-up results from the previous context.
- Conversation change invalidates previous message-load results.
- Do not introduce cancellation infrastructure or a synchronization layer.

## Loading, Empty, Error, Validation, And Unauthorized Handling

- Conversation list: loading, empty, success, safe error.
- Creation: title validation, active/disabled submit, safe failure.
- Messages: no active conversation guidance, loading, empty, success, safe error.
- Send: whitespace validation, active/disabled submit, safe failure.
- Unauthorized response from any function: reuse existing auth behavior by clearing auth and selected MindSpace state and redirecting to locale login.

## Logout And Auth Integration

- Keep existing `AppShell` logout unchanged.
- Chat receives no auth provider; it reads the token using `getAuthState` like existing protected functionality.
- Existing `AuthGate` remains the route protection boundary.

## EN/AR And RTL/LTR Handling

- Add conversation list, creation, message roles, composer, validation, loading, empty, and error text to both message files.
- Reuse the locale layout's `lang` and `dir`; use logical CSS and no duplicated direction state.
- Keep list and message panes stacked or simply rearranged at mobile widths without complex navigation behavior.

## Test And Validation Approach

- No frontend test tooling is installed; do not add a test framework.
- Run `npm run typecheck` and `npm run build` from `frontend/`.
- Manually validate list filtering, create/open, chronological messages, empty-send prevention, duplicate-send prevention, send-and-reload, MindSpace reset, stale response protection, unauthorized redirect, logout, EN/AR, RTL/LTR, keyboard operation, and mobile/desktop layout.
- If test tooling exists by implementation time, use it only for focused behavior coverage.

## Scope Confirmation

This plan introduces no global chat state, context/provider, generic API client, repository, adapter, factory, service layer, new auth framework, new dependency, optimistic rollback, streaming, WebSocket/SSE, markdown, citations, attachments, voice, search, product screen, conversation management, message management, retry/regenerate, pagination, or direct Agent/RAG call.

## Complexity Tracking

No constitution violations. No complexity exceptions required.
