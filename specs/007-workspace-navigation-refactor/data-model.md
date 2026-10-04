# Data Model: T034 Workspace Shell, Navigation & Chat UX Refactor

T034 introduces no persisted backend entity. This document defines frontend route, shared-state, and interaction models needed to preserve current backend-owned data behavior.

## Workspace Section

- `segment`: one of `chat`, `documents`, `tasks`, `notes`, or `memories`.
- `href`: absolute locale-prefixed destination.
- `labelKey`: translated navigation label.
- `titleKey`: translated Header title.
- `isActive`: derived from exact current child route segment equality.

Rules:

- Exactly one known child section is active on an approved child route.
- Active state comes from routing, never a local tab selection.
- Unknown segments do not silently activate Chat.
- Destination locale always matches the active locale.
- Memories is navigable but has no data contract.

## Authenticated Identity

- `accessToken`: existing bearer token in session auth state.
- `userId`: existing backend identity field; not displayed as a fabricated name and not sent manually to feature APIs.
- `email`: sole authenticated identity text available to Header.
- `initial`: optional presentation value derived from the first displayable email character.

Rules:

- Missing auth prevents protected shell rendering and redirects to same-locale login.
- Logout clears auth and selected MindSpace storage.
- No name, avatar, profile status, or profile request is introduced.

## MindSpace Context

- `status`: `loading`, `success`, `empty`, or `error`.
- `mindSpaces`: backend-returned owned MindSpaces with `id` and `name`.
- `selectedId`: one validated ID or null before validation/when empty.
- `showCreate`: whether additional MindSpace creation is visible.

Relationships:

- `selectedId` references exactly one entry in `mindSpaces` whenever status is `success`.
- The active data feature receives `selectedId`; inactive features are unmounted.
- Authentication owns access to MindSpaces, but backend remains authoritative for ownership.

Validation rules:

- A restored stored ID is accepted only when present in the latest returned list.
- Missing/stale selection falls back to the first returned MindSpace and persists it.
- Empty list clears stored selection and exposes onboarding.
- Successful creation inserts/de-duplicates the record, selects and persists it, and changes status to `success`.
- Route navigation does not modify selection.
- Full refresh reloads and revalidates selection.

State transitions:

```text
workspace mount
  -> auth gate
  -> MindSpaces loading
  -> success(valid restored ID | persisted first-item fallback)
  -> empty(clear selection, onboarding)
  -> error(safe shell error)

selection change
  -> persist selected ID
  -> active feature receives new ID
  -> active feature performs its existing reset/reload

MindSpace created
  -> insert/de-duplicate returned MindSpace
  -> select and persist returned ID
  -> close creation UI
  -> active feature mounts/reloads

logout/current unauthorized response
  -> clear auth and selected ID
  -> replace with same-locale login
```

## Workspace Shell State

- `currentSection`: current known route segment or null.
- `isWorkspaceSheetOpen`: shell-local mobile Sheet state.
- `workspaceMenuOpener`: focus restoration target.
- `mainContentTarget`: focus destination after mobile route activation.
- `children`: active route content only.

Rules:

- Shell state persists during sibling client navigation.
- Route activation closes the workspace Sheet and transfers focus to new content.
- Dismissal without route change restores focus to its opener.
- Workspace drawer state does not contain Chat conversation IDs or panel state.

## Feature Route State

- `mindSpaceId`: non-null selected ID from workspace context.
- `featureLocalState`: existing records, forms, selections, errors, and request identities owned by the mounted feature.

Rules:

- Each data route mounts exactly one of Chat, Documents, Tasks, or Notes.
- Navigating away unmounts the feature and discards its local state.
- Returning remounts and reloads according to current feature behavior.
- Memories has no feature data or request state.
- Auth and MindSpace are the only state required to survive sibling navigation.

## Mobile Sheet State

Workspace Sheet:

- `isOpen`: shell-local boolean synchronized with shadcn Sheet state.
- `opener`: workspace-menu button.
- `focusDestination`: close control/first link on open; opener on dismiss; Main Content after navigation.

Chat conversation Sheet:

- `isOpen`: Chat-local boolean synchronized with shadcn Sheet state.
- `opener`: conversation-panel button.
- `focusDestination`: close/create/list control on open; opener on dismiss; conversation heading/message region after selection.

Rules:

- Sheet IDs, controls, state, and selection models are distinct.
- Escape closes only the active Sheet.
- shadcn Sheet modal behavior blocks obscured-content interaction and manages focus according to the primitive contract.
- Breakpoint changes/unmount close Sheets cleanly without leaving focus in hidden content.
- Logical-side placement follows inherited document direction.

## Chat Conversation Context

- `mindSpaceId`: current shell-selected MindSpace.
- `conversations`: existing backend conversation records for that MindSpace.
- `listStatus`: `loading`, `empty`, `success`, or `error`.
- `activeConversationId`: selected conversation or null.
- `messages`: existing backend messages for the active conversation.
- `messageStatus`: `idle`, `loading`, `empty`, `success`, or `error`.
- `conversationDraft`: existing title and validation/create state.
- `messageDraft`: existing content and validation/send state.
- `requestIds`: monotonically increasing list/message/create/send identities.

Rules:

- Existing API contracts and current 401/404/error behavior remain authoritative.
- Accepted continuations match current request, MindSpace, and conversation context.
- MindSpace change clears all conversation/message/draft/send state and invalidates requests.
- Unmount invalidates all request identities.
- Feature-local state is not preserved after leaving Chat.

## Chat Scroll Context

- `scrollHost`: stable message-region element.
- `nearBottom`: whether remaining scroll distance is at most 80 CSS pixels.
- `pendingPlan`: `bottom` or `none` for the next accepted render.
- `planConversationId`: conversation identity associated with a pending plan.
- `nearAtSend`: near-bottom value captured when send begins.

Validation rules:

- Remaining distance is `max(0, scrollHeight - clientHeight - scrollTop)`.
- `remaining <= 80` means near bottom; `remaining > 80` means deliberate history reading.
- Scroll plans apply only after accepted active-context messages render.
- Applying a bottom plan writes `scrollTop = scrollHeight` once and clears the plan.
- No plan means no programmatic scroll write, preserving current reading position.

State transitions:

```text
open/switch conversation
  -> reset scroll intent
  -> loading
  -> accepted initial messages
  -> pendingPlan bottom
  -> post-render bottom write

same-conversation update
  -> measure before data update
  -> near bottom: pendingPlan bottom
  -> reading history: pendingPlan none

send begins
  -> capture nearAtSend
  -> existing send request
  -> before accepted refresh data: measure current near-bottom
  -> nearAtSend OR current near-bottom: pendingPlan bottom
  -> otherwise: pendingPlan none

manual scroll
  -> recompute nearBottom
  -> <=80 enables future auto-pin
  -> >80 protects reading position

MindSpace change or unmount
  -> clear plan/intent
  -> invalidate all requests
```

## Viewport And Overflow Model

- `workspaceViewport`: protected route root bounded to current usable viewport.
- `sidebar`: persistent desktop navigation column or mobile shadcn Sheet.
- `workspaceColumn`: Header plus remaining Main Content row.
- `mainContent`: normal section scroll host, except Chat route containment.
- `conversationScrollHost`: Chat-local independent list overflow.
- `messageScrollHost`: Chat-local independent message overflow.
- `composer`: non-scrolling final message-pane row.

Rules:

- Every shrinkable ancestor has zero minimum block/inline size as appropriate.
- Chat does not increase document height with conversation/message count.
- Conversation and message regions can overflow independently.
- Composer and Header bounding boxes remain within the viewport during normal Chat use.
- Non-Chat features use Main Content scrolling.
- Public pages are outside this model.
