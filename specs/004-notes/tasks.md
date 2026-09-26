# Tasks: Notes

**Input**: Design documents from `/specs/004-notes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/notes.md, quickstart.md

**Tests**: Use existing frontend test tooling only. No frontend test framework currently exists, so do not add one; validate with typecheck, build, and the manual quickstart scenarios.

**Organization**: Tasks are grouped by user story. Tasks that converge on `frontend/components/notes.tsx` remain sequential after the browse/open foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it affects different files and has no dependency on another incomplete task in the same group
- **[Story]**: User story label used only in user story phases
- Every task includes exact file paths, required behavior, and an acceptance check

## Phase 1: Setup And Contract Confirmation

**Purpose**: Confirm existing integration patterns and exact NestJS contracts before implementation.

- [X] T001 Inspect `frontend/components/auth-gate.tsx`, `frontend/components/app-shell.tsx`, `frontend/components/chat.tsx`, `frontend/lib/auth-state.ts`, `frontend/lib/mindspace-selection.ts`, `frontend/lib/api/conversations.ts`, `frontend/next.config.ts`, `backend/src/main.ts`, `backend/src/notes/notes.controller.ts`, `backend/src/notes/notes.service.ts`, `backend/src/notes/dto/create-note.dto.ts`, and `backend/prisma/schema.prisma`; acceptance: confirm existing bearer auth and locale login redirect, current MindSpace prop pattern, direct `NEXT_PUBLIC_NEST_API_BASE_URL` usage with no rewrite/proxy, raw list/create/get-one Note responses, exact `mindSpaceId` spelling, `updatedAt` descending list order, ownership checks, no `userId` request field, complete Note fields, and absence of frontend test tooling without changing backend behavior.

---

## Phase 2: Foundational Notes Support

**Purpose**: Add the shared contract functions and translated text required by every story.

**Critical**: User story work starts only after both foundational tasks complete.

- [X] T002 [P] Create `frontend/lib/api/notes.ts` with minimal `Note`, create input, safe error code/class, and direct `listNotes`, `createNote`, and `getNote` functions; acceptance: use the existing API base URL and bearer pattern, encode the exact `mindSpaceId` query value and note ID, return raw backend arrays/records without envelopes or normalization, distinguish unauthorized/not-found/general failures, send no `userId`, and add no generic client, repository, adapter, service layer, proxy, or dependency.
- [X] T003 [P] Add matching Notes labels, list/selection/creation states, field validation, unavailable text, and safe errors to `frontend/messages/en.json` and `frontend/messages/ar.json`; acceptance: both locale files have the same Notes key structure and no user-facing Notes text needs hard-coding.

**Checkpoint**: Direct Notes contracts and all translated text are available with no new architecture.

---

## Phase 3: User Story 1 - Browse And Open Notes (Priority: P1) MVP

**Goal**: The current MindSpace shows only its notes, and selecting one loads and displays its authoritative title and plain-text content.

**Independent Test**: Select a MindSpace containing notes, open Notes, select one note, and confirm only that MindSpace's backend-ordered notes appear and the get-one response supplies the readable title/content; also verify loading, empty, unavailable, and safe error states.

### Implementation for User Story 1

- [X] T004 [P] [US1] Create `frontend/components/notes.tsx` with component-local list and selected-note state using `listNotes` and `getNote`; acceptance: read the existing token, render list loading/empty/success/safe-error states, do not auto-select, clear old selected content before each selection, render selection idle/loading/success/unavailable/safe-error states, preserve plain-text line breaks, require returned `mindSpaceId` to match current context, use semantic labeled keyboard controls, and handle missing-token/401 responses with existing auth and MindSpace clearing plus locale login redirect.
- [X] T005 [P] [US1] Update `frontend/components/app-shell.tsx` to render `Notes` only when shell status is successful and `selectedId` is valid; acceptance: pass only the current MindSpace ID, preserve existing MindSpace selection, Chat rendering, AuthGate boundary, and logout behavior, and add no route, provider, or global state.

**Checkpoint**: User Story 1 independently supports scoped note browsing and authoritative note reading.

---

## Phase 4: User Story 2 - Create A Note (Priority: P2)

**Goal**: The user can create one valid plain-text note in the current MindSpace and immediately see it in the list and reading pane.

**Independent Test**: Enter a valid title and content, submit once, and confirm the raw created record is prepended and opened without reload or get-one; invalid and duplicate submissions make no extra requests, while failure preserves both inputs.

### Implementation for User Story 2

- [X] T006 [US2] Add the labeled creation form and flow to `frontend/components/notes.tsx`; acceptance: trim title/content, reject either whitespace-only value with translated validation and no request, disable duplicate submission while active, call `createNote` with `{mindSpaceId, title, content}` only, keep values visible while active and on failure, show safe request errors, and on accepted success prepend the returned persisted Note, set list success, select/display it without a redundant get-one or reload, and clear the form only after success.

**Checkpoint**: User Story 2 independently creates and opens notes without speculative records or additional CRUD.

---

## Phase 5: User Story 3 - Preserve Context Across MindSpaces (Priority: P3)

**Goal**: Changing MindSpace immediately removes the previous Notes context, and late list, selection, or creation results cannot overwrite the new context.

**Independent Test**: Open a note and enter a creation draft, change MindSpace during delayed list/get-one/create requests, and confirm prior list, selection, content, draft, validation, unavailable state, and errors clear before loading while every late result is ignored; verify unauthorized responses still return to login.

### Implementation for User Story 3

- [X] T007 [US3] Complete MindSpace reset and stale-request protection in `frontend/components/notes.tsx`; acceptance: keep current MindSpace/selected note refs and minimal list/select/create request identities, invalidate all request categories on `mindSpaceId` change, synchronously clear notes, selection, displayed content, form values, validation, active creation, unavailable state, and errors before the new list request, invalidate prior get-one on new selection, reject stale success and failure handlers including old create responses, and route 401 from list/get-one/create through existing auth clearing and locale login behavior without cancellation infrastructure.

**Checkpoint**: All user stories work with strict current-MindSpace context and stale-result safety.

---

## Phase 6: Polish And Cross-Cutting Integration

**Purpose**: Complete responsive accessibility, scope review, and end-to-end validation.

- [X] T008 Update `frontend/components/notes.tsx` and `frontend/app/globals.css` for accessible responsive EN/AR behavior; acceptance: list buttons expose clear selected state, form fields have associated labels and validation semantics, status/error regions use appropriate live or alert semantics, long titles/content wrap with line breaks preserved, logical alignment works under inherited LTR/RTL, list/create and reading panes remain usable on desktop and stack on mobile, `notes.tsx` normally remains below 300 lines, and no out-of-scope controls are introduced.
- [X] T009 Run `npm run typecheck` and `npm run build` from `frontend/`, then execute and record results in `specs/004-notes/quickstart.md`; acceptance: automated checks pass and available manual validation covers auth gating, scoped ordered list, loading/empty/error states, authoritative selection, fast reselection, unavailable note, title/content validation, duplicate prevention, create-and-open without reload/get-one, preserved failed draft, MindSpace reset, stale list/select/create results, unauthorized redirect, unchanged logout, EN/AR, RTL/LTR, keyboard use, long content, desktop/mobile layout, and absence of out-of-scope features or new dependencies.

---

## Dependencies And Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 confirms contracts and existing integration first.
- **Foundational (Phase 2)**: T002 and T003 depend on T001 and block every user story.
- **US1 (Phase 3)**: T004 and T005 depend on T002/T003 and can run in parallel because they modify different files; both must complete for the MVP checkpoint.
- **US2 (Phase 4)**: T006 depends on the Notes component and list/selection state from T004.
- **US3 (Phase 5)**: T007 depends on T004 and T006 because it coordinates every list, selection, and create request state in the same component.
- **Polish (Phase 6)**: T008 follows all stories; T009 follows T008.

### User Story Dependencies

- **US1 Browse And Open Notes**: MVP; starts after shared foundations and establishes the Notes component.
- **US2 Create A Note**: Uses US1 list and selected-note state while remaining independently testable through create-and-open.
- **US3 Preserve Context Across MindSpaces**: Hardens the shared component after list, selection, and creation flows exist.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001 because API and locale files do not overlap.
- T004 and T005 can run in parallel after Phase 2 because the Notes component and AppShell integration are separate files.
- US2 and US3 intentionally have no internal parallel split because their state transitions converge on `frontend/components/notes.tsx`; artificial parallel tasks would create file conflicts.
- T008 and T009 remain sequential because validation must cover final styling and semantics.

---

## Parallel Examples

### Foundational

```text
Task T002: "Create frontend/lib/api/notes.ts with direct raw NestJS contracts"
Task T003: "Add matching Notes translations to frontend/messages/en.json and frontend/messages/ar.json"
```

### User Story 1

```text
Task T004: "Create browse/open behavior in frontend/components/notes.tsx"
Task T005: "Integrate Notes in frontend/components/app-shell.tsx"
```

### User Story 2

No safe internal parallelism: T006 owns one cohesive creation state machine in `frontend/components/notes.tsx`.

### User Story 3

No safe internal parallelism: T007 coordinates list, selection, and creation request identities in `frontend/components/notes.tsx`.

---

## Implementation Strategy

### MVP First

1. Complete T001 contract confirmation.
2. Complete T002-T003 foundations.
3. Complete T004-T005 browse/open Notes behavior.
4. Stop and validate User Story 1 independently before adding creation.

### Incremental Delivery

1. Add scoped note list and authoritative note opening as the MVP.
2. Add validated create-and-open behavior with no reload.
3. Add complete MindSpace reset and stale-result protection across all request types.
4. Complete accessibility, responsive styling, scope review, and automated/manual validation.

### Scope Guardrails

- Do not add global state, context/provider, custom hooks, generic API clients, repositories, adapters, factories, service layers, proxy/rewrite routes, new auth, dependencies, or backend changes.
- Do not add edit/delete, rich text or Markdown, tags, search, sorting/filtering, attachments, sharing, version history, Agent-specific UI, pagination, prefetching, or direct internal-service calls.
- Keep NestJS authoritative for authentication, ownership, persistence, ordering, and stored values; send no `userId`.

## Notes

- Every task includes an exact path and acceptance check suitable for direct execution.
- `[P]` is used only where files and dependencies permit safe parallel work.
- User story labels map directly to the prioritized scenarios in `spec.md`.
- Mark each task `[X]` only after its acceptance check is satisfied.
