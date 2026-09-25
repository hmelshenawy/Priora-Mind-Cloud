# Tasks: Conversations and Chat

**Input**: Design documents from `/specs/003-conversations-chat/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/conversations-and-messages.md, quickstart.md

**Tests**: Use existing frontend test tooling only. No frontend test tooling currently exists, so do not add a test framework.

**Organization**: Tasks are grouped by user story and remain sequential where they modify the same Chat component.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it affects different files and has no dependency on incomplete tasks
- **[Story]**: User story label for story phases only
- Every task includes exact files, behavior, and an acceptance check

## Phase 1: Setup And Contract Confirmation

**Purpose**: Confirm existing frontend integration and exact NestJS contracts before implementation.

- [X] T001 Inspect `frontend/components/app-shell.tsx`, `frontend/lib/auth-state.ts`, `frontend/lib/mindspace-selection.ts`, `frontend/lib/api/mindspaces.ts`, `backend/src/conversations/conversations.controller.ts`, `backend/src/conversations/conversations.service.ts`, `backend/src/conversations/conversation-messages.service.ts`, `backend/src/conversations/dto/create-conversation.dto.ts`, and `backend/src/conversations/dto/create-message.dto.ts`; acceptance: confirm bearer auth, actual list/create/load/send request and response shapes, exact `minspaceId` list query spelling, chronological message ordering, `{role, content}` send response, existing API base URL pattern, and absence of frontend test tooling without changing backend behavior.

---

## Phase 2: Foundational Conversation Support

**Purpose**: Add only contract-specific API functions and translated chat text.

- [X] T002 Create `frontend/lib/api/conversations.ts` with minimal `Conversation`, `Message`, Agent reply, request, and safe error types plus direct `listConversations`, `createConversation`, `listMessages`, and `sendMessage` functions; acceptance: functions match the contracts confirmed in T001, use bearer auth and the existing NestJS base URL, preserve `minspaceId`, send no `userId`, distinguish unauthorized/not-found/general failures, and add no generic client, adapter, repository, or service layer.
- [X] T003 [P] Add conversation-list, creation, message-role, composer, validation, loading, empty, sending, and safe-error strings to `frontend/messages/en.json` and `frontend/messages/ar.json`; acceptance: locale files have matching chat keys and no user-facing Chat text needs hard-coding.

**Checkpoint**: Contract calls and translated strings are ready without new dependencies or architecture.

---

## Phase 3: User Story 1 - Browse And Open Conversations (Priority: P1) MVP

**Goal**: The current MindSpace shows its conversation list, and selecting a conversation shows chronological messages.

**Independent Test**: Select a MindSpace with conversations, open one, and confirm only that MindSpace's conversations and the selected conversation's ordered messages appear; switching MindSpace clears the old context first.

### Implementation for User Story 1

- [X] T004 [US1] Create `frontend/components/chat.tsx` and update `frontend/components/app-shell.tsx` to pass the valid current MindSpace ID into it; acceptance: Chat reads the existing access token, loads conversations with `listConversations`, renders list loading/empty/success/error states, resets conversations, active ID, messages, inputs, and errors immediately when `mindSpaceId` changes, and ignores stale list results using a local request identity or effect cleanup without a custom hook/provider/global store.
- [X] T005 [US1] Add active-conversation and message-history behavior in `frontend/components/chat.tsx`; acceptance: selecting a conversation clears prior history, calls `listMessages`, renders message loading/empty/success/error states in backend chronological order, visually and semantically distinguishes USER and ASSISTANT roles, and ignores stale message results after conversation or MindSpace changes.

**Checkpoint**: User Story 1 independently supports scoped conversation browsing and ordered message history.

---

## Phase 4: User Story 2 - Create A Conversation (Priority: P2)

**Goal**: The user can create and open a titled conversation in the current MindSpace.

**Independent Test**: Enter a valid title, create the conversation, and confirm it is added to the list and opened; invalid and duplicate submissions send no extra requests.

### Implementation for User Story 2

- [X] T006 [US2] Add the conversation-creation form and flow to `frontend/components/chat.tsx`; acceptance: title input is labeled, trimmed, requires at least three characters, disables duplicate submission while active, calls `createConversation` with the current `mindSpaceId`, adds the returned record to the list, makes it active, clears the title input, sets messages to an empty array without calling `listMessages` for the newly created conversation, shows safe validation/request errors, and ignores success from a previous MindSpace.

**Checkpoint**: User Story 2 independently creates and opens conversations without reload or CRUD beyond creation.

---

## Phase 5: User Story 3 - Send A Message (Priority: P3)

**Goal**: The user can send one non-empty message at a time and see the persisted user and assistant messages from NestJS.

**Independent Test**: Open a conversation, submit content, and confirm duplicate sends are blocked, the same conversation remains active, and reloaded history shows both persisted messages.

### Implementation for User Story 3

- [X] T007 [US3] Add a labeled textarea, validation, and sending state to `frontend/components/chat.tsx`; acceptance: composer is enabled only for an active conversation, whitespace-only content sends no request, active send disables duplicate submission, submitted content remains visible with clear sending feedback, and safe validation text is translated.
- [X] T008 [US3] Wire message submission in `frontend/components/chat.tsx` to `sendMessage` and then `listMessages`; acceptance: NestJS alone receives the message and calls Agent, successful send keeps the same conversation active, clears the composer only after success, reloads authoritative chronological history to show user and assistant messages, preserves content on failure, and ignores send/reload results if MindSpace or active conversation changed.

**Checkpoint**: User Story 3 independently sends messages through NestJS without optimistic rollback or speculative synchronization.

---

## Phase 6: Polish And Cross-Cutting Integration

**Purpose**: Complete shared errors, auth behavior, accessibility, responsiveness, and validation.

- [X] T009 Complete unauthorized/not-found/general error handling across `frontend/lib/api/conversations.ts` and `frontend/components/chat.tsx`; acceptance: unauthorized responses clear auth and selected MindSpace state and redirect to locale login, invalid conversation context resets safely where appropriate, general failures expose no backend details, and existing AppShell logout remains unchanged.
- [X] T010 Update `frontend/components/chat.tsx` and `frontend/app/globals.css` for accessible responsive EN/AR behavior; acceptance: conversation controls, title form, list selection, message history, textarea, and send button are keyboard accessible and labeled, user/assistant messages are distinct, logical layout works under inherited LTR/RTL on desktop and mobile, `chat.tsx` remains below 300 lines or is split only at a real presentation boundary, and no out-of-scope routes or features are added.
- [ ] T011 Run `npm run typecheck` and `npm run build` from `frontend/`, then complete `specs/003-conversations-chat/quickstart.md`; acceptance: automated checks pass and manual validation covers scoped list loading, empty states, create/open, chronological messages, title/message validation, duplicate prevention, send-and-reload, MindSpace reset, stale result protection, safe errors, unauthorized redirect, logout, EN/AR, RTL/LTR, keyboard use, and desktop/mobile layout; do not add tests because no existing frontend test tooling is available.

---

## Dependencies And Execution Order

### Phase Dependencies

- **Setup**: T001 must complete first to confirm exact contracts.
- **Foundational**: T002 and T003 depend on T001 and block user stories.
- **US1**: T004 depends on T002/T003; T005 depends on T004.
- **US2**: T006 depends on the Chat list and active-conversation state from US1.
- **US3**: T007 depends on an active conversation; T008 depends on T007 and the API functions.
- **Polish**: T009-T011 follow all user-story behavior.

### User Story Dependencies

- **US1 Browse And Open Conversations**: MVP and foundation for active conversation/history.
- **US2 Create A Conversation**: Uses US1 list and active-conversation behavior.
- **US3 Send A Message**: Uses US1 active conversation and message history; it can also use conversations created by US2.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001 because they affect different files.
- Remaining tasks are sequential because they converge on `frontend/components/chat.tsx`.
- No artificial parallelism is introduced for tasks touching shared state/UI files.

---

## Parallel Example: Foundational

```text
Task: "T002 Create frontend/lib/api/conversations.ts"
Task: "T003 Add EN/AR Chat messages"
```

---

## Implementation Strategy

### MVP First

1. Complete T001 contract confirmation.
2. Complete T002-T003 foundations.
3. Complete T004-T005 conversation browsing and message loading.
4. Stop and validate User Story 1 independently.

### Incremental Delivery

1. Add scoped conversation list and opening/history.
2. Add conversation creation.
3. Add message composer, send, and authoritative reload.
4. Complete auth/error handling, accessibility, responsive styling, and validation.

### Scope Guardrails

- Do not add global state, context/provider, custom hooks, generic API clients, adapters, repositories, factories, service layers, new dependencies, new routes, or direct Agent/RAG calls.
- Do not add optimistic rollback, streaming, WebSocket/SSE, markdown, citations, attachments, voice, search, retries, pagination, conversation management, message management, or out-of-scope product screens.
- Keep NestJS as the source of truth and send no `userId`.
