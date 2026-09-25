# Feature Specification: Conversations and Chat

**Feature Branch**: `main`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Create SPEC-003: Conversations + Chat for Priora MindCloud. Authenticated users can list and create conversations in the current MindSpace, open message history, send messages through NestJS, and see returned assistant responses."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse And Open Conversations (Priority: P1)

An authenticated user with a valid current MindSpace can view its conversations, select one, and read its messages in chronological order.

**Why this priority**: Conversation and message history establish the context required before the user can continue a chat.

**Independent Test**: Select a MindSpace with existing conversations, open one conversation, and confirm its ordered message history appears.

**Acceptance Scenarios**:

1. **Given** the user is authenticated with a current MindSpace, **When** they open Chat, **Then** only conversations belonging to that MindSpace are listed.
2. **Given** a conversation is listed, **When** the user selects it, **Then** its messages load in chronological order and user and assistant messages are visually distinguishable.
3. **Given** the current MindSpace changes, **When** Chat responds to the change, **Then** the previous conversation and messages are cleared and the new MindSpace's conversations load.

---

### User Story 2 - Create A Conversation (Priority: P2)

An authenticated user can create a titled conversation in the current MindSpace and begin using it as the active conversation.

**Why this priority**: Users need a conversation before they can start a new chat when no suitable conversation exists.

**Independent Test**: Enter a valid title, create a conversation, and confirm it appears in the current MindSpace list and becomes active.

**Acceptance Scenarios**:

1. **Given** a valid current MindSpace, **When** the user submits a valid conversation title, **Then** a conversation is created in that MindSpace, added to the list, and opened.
2. **Given** no current MindSpace is available, **When** the user views Chat, **Then** conversation creation and chat actions are unavailable and clear guidance is shown.

---

### User Story 3 - Send A Message (Priority: P3)

An authenticated user can send a non-empty message in the active conversation and see the assistant response returned through NestJS.

**Why this priority**: Message exchange is the primary value of the chat experience once conversation context exists.

**Independent Test**: Open a conversation, send a message, and confirm the user content and returned assistant response appear while the same conversation remains active.

**Acceptance Scenarios**:

1. **Given** an active conversation, **When** the user submits non-empty content, **Then** the content is shown immediately or with a clear sending state and is sent through NestJS.
2. **Given** a message request is active, **When** the user tries to submit again, **Then** duplicate submission is prevented.
3. **Given** NestJS returns an assistant response, **When** the request succeeds, **Then** the response appears after the user message and the conversation remains active.
4. **Given** the message is empty or whitespace only, **When** the user submits, **Then** no request is sent and clear validation is shown.

---

### Edge Cases

- The current MindSpace has no conversations.
- An opened conversation has no messages.
- The selected MindSpace changes while a conversation or message request is active.
- A conversation or message request fails or becomes unauthorized.
- The chat is used in English LTR, Arabic RTL, desktop, and mobile layouts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Chat MUST be available only to authenticated users with a valid current MindSpace.
- **FR-002**: The frontend MUST load conversations for the current MindSpace from NestJS and MUST NOT include conversations from another MindSpace.
- **FR-003**: The conversation list MUST provide distinct loading, empty, success, and error states.
- **FR-004**: Users MUST be able to select one listed conversation as the active conversation.
- **FR-005**: Opening a conversation MUST load its messages from NestJS in chronological order.
- **FR-006**: User and assistant messages MUST be clearly distinguishable.
- **FR-007**: Users MUST be able to create a conversation with a valid title in the current MindSpace.
- **FR-008**: A successfully created conversation MUST be added to the current list and opened without requiring a page reload.
- **FR-009**: Conversation creation MUST show clear active, success, validation, and failure states and prevent duplicate submission while active.
- **FR-010**: Chat actions MUST be unavailable when no valid current MindSpace exists.
- **FR-011**: Users MUST be able to compose and send a non-empty message only when a conversation is active.
- **FR-012**: Whitespace-only messages MUST NOT be sent.
- **FR-013**: Duplicate message submission MUST be prevented while a send request is active.
- **FR-014**: During send, the submitted user content MUST be visible immediately or accompanied by an equally clear sending state.
- **FR-015**: The assistant response returned by NestJS MUST appear after the user message in the active conversation.
- **FR-016**: After a successful send, the same conversation MUST remain active.
- **FR-017**: Message loading and sending MUST provide safe loading and error states without exposing backend internals.
- **FR-018**: When the current MindSpace changes, the frontend MUST clear the active conversation, message history, composer state, and prior request errors before loading conversations for the new MindSpace.
- **FR-019**: Results from requests for a previous MindSpace or conversation MUST NOT overwrite the current context after selection changes.
- **FR-020**: Unauthorized responses MUST follow the existing authentication behavior and return the user to login.
- **FR-021**: Logout MUST continue to clear authentication and current MindSpace selection according to existing behavior.
- **FR-022**: Conversation, message, validation, loading, empty, and error text MUST support English and Arabic.
- **FR-023**: English MUST use LTR direction and Arabic MUST use RTL direction.
- **FR-024**: Conversation actions, selection, composer, and send controls MUST be keyboard accessible and clearly labeled.
- **FR-025**: The conversation list and message area MUST remain usable on desktop and mobile screens without advanced responsive behavior.
- **FR-026**: The frontend MUST communicate only with NestJS and MUST NOT call Agent, RAG, Qdrant, PostgreSQL, Supabase, storage, or other internal services directly.
- **FR-027**: The frontend MUST NOT send `userId`; NestJS owns authentication, authorization, ownership, and Agent orchestration.
- **FR-028**: This feature MUST NOT add conversation rename, archive, delete, streaming, markdown rendering, citations, attachments, voice, search, message editing/deleting, infinite scroll, complex pagination, retry/regenerate, WebSocket/SSE, Agent-tool visualization, or global chat state.

### API Boundary *(mandatory for frontend features)*

- **NestJS Endpoints Used**: Existing authenticated conversation list, conversation creation, conversation messages, and message-send endpoints under `/api/v1/conversations`. The frontend follows the actual existing request and response contracts.
- **Authentication Context**: Requests use the existing frontend access token. MindSpace and conversation identifiers are sent only where required by the existing NestJS contracts; `userId` is never sent.
- **Excluded Direct Access**: Frontend does not directly access Agent, RAG, Qdrant, PostgreSQL, Supabase, storage services, or other internal services.

### Key Entities *(include if feature involves data)*

- **Conversation**: A titled chat container belonging to one MindSpace, identified by a stable ID.
- **Message**: Ordered conversation content with a user or assistant role, content, and creation position or timestamp.
- **Active Conversation**: The conversation currently open for message history and sending; it is valid only within the current MindSpace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated user with a valid MindSpace can create or open a conversation and reach a usable message composer.
- **SC-002**: Selecting a conversation shows its messages in chronological order with user and assistant content visibly distinct.
- **SC-003**: A non-empty message can be submitted once, remains associated with the active conversation, and is followed by the assistant response returned through NestJS.
- **SC-004**: Empty submissions and duplicate submissions during an active send produce zero additional message requests.
- **SC-005**: Changing MindSpace removes the prior conversation context before displaying conversations for the new MindSpace.
- **SC-006**: Every data-driven area displays one clear loading, empty, success, or error state as applicable.
- **SC-007**: The complete chat flow is usable in English LTR, Arabic RTL, desktop, mobile, and keyboard-only interaction.
- **SC-008**: No direct Agent/RAG access, advanced chat UX, global chat state, new architecture, or out-of-scope product screen is introduced.

## Assumptions

- SPEC-001 authentication and SPEC-002 current MindSpace selection are available and remain the source of frontend context.
- The frontend follows the existing NestJS conversation and message contracts, including any required MindSpace filter naming.
- New conversation titles are entered by the user and must satisfy the existing backend validation.
- The assistant response is complete when returned; streaming is not supported in this feature.
- Simple finite message history is sufficient; complex pagination and infinite scroll are out of scope.
