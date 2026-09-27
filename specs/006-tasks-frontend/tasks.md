---

description: "Implementation tasks for SPEC-006 Tasks Frontend"
---

# Tasks: Tasks Frontend

**Input**: Design documents from `/specs/006-tasks-frontend/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tasks.md, quickstart.md

**Tests**: The specification explicitly requires behavior verification. The frontend has no test runner, so story-level tasks use the documented contract/browser scenarios and record results in `specs/006-tasks-frontend/quickstart.md`; final automated checks use existing typecheck and build scripts.

**Organization**: Tasks are grouped by user story so browse, create, and MindSpace-isolation behavior can be implemented and validated as distinct increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because the task changes a different file and has no dependency on incomplete work.
- **[Story]**: Maps the task to its user story from `spec.md`.
- Every task names the exact file or files it changes or validates.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean implementation baseline using the existing frontend toolchain.

- [x] T001 Run `npm run typecheck` and `npm run build` from `frontend/` using `frontend/package.json`, then record any pre-existing failures in `specs/006-tasks-frontend/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add only the shared Tasks record types and safe error primitive required by all user stories.

**CRITICAL**: Complete this phase before starting user-story implementation.

- [x] T002 Define exact `Task`, executor, and safe API error types without a generic client or response envelope in `frontend/lib/api/tasks.ts`

**Checkpoint**: Shared Tasks types and safe error semantics are available without a new dependency or generic API abstraction.

---

## Phase 3: User Story 1 - View MindSpace Tasks (Priority: P1) MVP

**Goal**: Show the selected MindSpace's tasks in backend order with complete metadata and clear loading, empty, success, and error states.

**Independent Test**: Select a MindSpace containing tasks, open the protected app, and confirm only that MindSpace's tasks appear in backend order with title, optional description, executor, status, and creation date; repeat with an empty and failing response.

### Implementation For User Story 1

- [x] T003 [P] [US1] Implement bearer-authenticated `listTasks(token, mindSpaceId)` with encoded query, raw-array response, and safe status mapping in `frontend/lib/api/tasks.ts`
- [x] T004 [P] [US1] Add English `tasks` keys `title`, `description`, `loading`, `empty`, `listError`, `createdAt`, `executorLabel`, `statusLabel`, `executorUser`, `executorAgent`, `statusPending`, `statusProgress`, `statusCompleted`, `statusCancelled`, and `invalidDate` in `frontend/messages/en.json`
- [x] T005 [P] [US1] Add Arabic `tasks` keys `title`, `description`, `loading`, `empty`, `listError`, `createdAt`, `executorLabel`, `statusLabel`, `executorUser`, `executorAgent`, `statusPending`, `statusProgress`, `statusCompleted`, `statusCancelled`, and `invalidDate` in `frontend/messages/ar.json`
- [x] T006 [US1] Implement the Tasks list component with a list request identity, authenticated loading, safe error handling, runtime record checks, locale-aware dates, known/unknown executor and status labels, and semantic loading/empty/success/error markup in `frontend/components/tasks.tsx`
- [x] T007 [US1] Add responsive `.tasks-*` section, list, card, metadata, long-text, and mobile styles using logical properties in `frontend/app/globals.css`
- [x] T008 [US1] Render `Tasks` for the valid shell-selected `mindSpaceId` without adding a route or second selector in `frontend/components/app-shell.tsx`

### Verification For User Story 1

- [ ] T009 [US1] Execute Quickstart contract scenarios 1-2 and browser scenarios 1-5 for page rendering, exact selected-MindSpace fetching, existing records, backend order, invalid-date fallback, loading/empty states, and controlled 400/404/429/network/service errors without internal-detail leakage; record results in `specs/006-tasks-frontend/quickstart.md`

**Checkpoint**: User Story 1 is a usable read-only Tasks MVP for one selected MindSpace.

---

## Phase 4: User Story 2 - Create A Task (Priority: P2)

**Goal**: Create a task for the selected MindSpace with title validation, optional description, supported executor values, immediate insertion, and one list revalidation.

**Independent Test**: Submit a valid task once and confirm the exact payload uses the selected MindSpace, the returned task appears once without reload, the form resets, and one list revalidation follows; verify whitespace title, duplicate submission, create failure, duplicate-ID response, and refresh failure behavior.

### Implementation For User Story 2

- [x] T010 [P] [US2] Define the exact create-input type and implement bearer-authenticated `createTask(token, input)` with exact JSON fields, raw-record response, and safe status mapping in `frontend/lib/api/tasks.ts`
- [x] T011 [P] [US2] Add English `tasks` keys `createAction`, `closeCreate`, `titleLabel`, `titlePlaceholder`, `descriptionLabel`, `descriptionPlaceholder`, `submit`, `submitting`, `titleRequired`, `createSuccess`, `createError`, and `refreshError` in `frontend/messages/en.json`
- [x] T012 [P] [US2] Add Arabic `tasks` keys `createAction`, `closeCreate`, `titleLabel`, `titlePlaceholder`, `descriptionLabel`, `descriptionPlaceholder`, `submit`, `submitting`, `titleRequired`, `createSuccess`, `createError`, and `refreshError` in `frontend/messages/ar.json`
- [x] T013 [US2] Add the accessible open/dismiss creation form, controlled title/description/executor fields, trimmed-title validation, blank-description omission, duplicate-submit guard, and preserved failed draft in `frontend/components/tasks.tsx`
- [x] T014 [US2] Add responsive `.tasks-*` creation form, field, validation, submitting, success, and refresh-error styles in `frontend/app/globals.css`
- [x] T015 [US2] Implement a create request identity plus current-context create handling, required-field and expected-MindSpace response validation, ID replacement/prepend behavior, accepted-success reset, older-list identity invalidation, one post-create list revalidation, and failed-revalidation preservation in `frontend/components/tasks.tsx`

### Verification For User Story 2

- [ ] T016 [US2] Execute Quickstart contract scenarios 3-7 and browser scenarios 6-15 for payload shape, `USER`/`AGENT`, zero-request title validation, submitting guard, insertion/reset, duplicate IDs, malformed/wrong-MindSpace response rejection, controlled 400/404/429/network/service errors without internal-detail leakage, and revalidation success/failure; record results in `specs/006-tasks-frontend/quickstart.md`

**Checkpoint**: User Stories 1 and 2 support complete V1 task browsing and creation without a page reload.

---

## Phase 5: User Story 3 - Preserve MindSpace Context (Priority: P3)

**Goal**: Clear prior task state immediately on MindSpace changes and prevent late responses or replaced-session authentication failures from corrupting the active context.

**Independent Test**: Delay list/create/revalidation responses, switch MindSpaces, and confirm old task/form/error state clears before the new list and late non-authentication results make no visible change; verify current-session and replaced-session 401 behavior.

### Implementation For User Story 3

- [x] T017 [US3] Add the current-MindSpace ref, complete MindSpace-change reset, list/create identity invalidation, stale non-authentication continuation guards, and captured-token 401 session checks in `frontend/components/tasks.tsx`
- [x] T018 [P] [US3] Key the Tasks integration by selected MindSpace so shell selection changes remount its local state while retaining the passed shell-selected `mindSpaceId` in `frontend/components/app-shell.tsx`

### Verification For User Story 3

- [ ] T019 [US3] Execute Quickstart browser scenarios 16-19 using sequence-aware request interception for MindSpace reset, stale list/create/revalidation isolation, current/replaced-session 401 behavior, and logout regression; record results in `specs/006-tasks-frontend/quickstart.md`

**Checkpoint**: All three user stories are functional and isolated across MindSpace and authentication-session changes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate accessibility, localization, responsive behavior, scope, and the complete frontend build.

- [ ] T020 Execute Quickstart browser scenarios 20-22 for keyboard operation, EN/LTR, AR/RTL, desktop/mobile layout, long text, and excluded controls; record results in `specs/006-tasks-frontend/quickstart.md`
- [x] T021 Review `frontend/components/tasks.tsx`, `frontend/lib/api/tasks.ts`, and `frontend/components/app-shell.tsx` against `specs/006-tasks-frontend/contracts/tasks.md` to confirm no `userId`, status mutation, direct Agent/internal-service call, global state, generic client, or out-of-scope task capability was introduced
- [x] T022 Run `npm run typecheck` and `npm run build` from `frontend/` using `frontend/package.json` plus `git diff --check` from the repository root, then record final results in `specs/006-tasks-frontend/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; establishes the baseline.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational and delivers the read-only MVP.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because creation must update and revalidate the visible list.
- **User Story 3 (Phase 5)**: Depends on User Stories 1 and 2 so guards cover every list/create/revalidation state.
- **Polish (Phase 6)**: Depends on all selected user stories.

### User Story Dependency Graph

```text
Setup
  -> Foundation
    -> US1 View Tasks (MVP)
      -> US2 Create Task
        -> US3 Preserve MindSpace Context
          -> Polish and full validation
```

### Within Each User Story

- Implement contract-backed behavior before running that story's verification task.
- Complete UI behavior before integrating it into `AppShell` when the integration imports a new component.
- Keep backend response fields and ordering authoritative.
- Run and record each story checkpoint before moving to the next priority.

### Parallel Opportunities

- T003, T004, and T005 can run in parallel after Foundation because they modify the API module and separate locale files using the specified key schema.
- T010, T011, and T012 can run in parallel after User Story 1 because they modify the API module and separate locale files using the specified key schema.
- T018 can run in parallel with T017 after User Story 2 because it modifies `app-shell.tsx` while T017 modifies `tasks.tsx`.
- Story verification tasks are sequential checkpoints because each validates the code produced in its story phase.

---

## Parallel Example: User Story 1

```text
Task T003: Implement listTasks in frontend/lib/api/tasks.ts
Task T004: Add the specified English list key schema in frontend/messages/en.json
Task T005: Add the identical Arabic list key schema in frontend/messages/ar.json
After all three: Task T006 implements task list behavior in frontend/components/tasks.tsx
```

## Parallel Example: User Story 2

```text
Task T010: Implement createTask in frontend/lib/api/tasks.ts
Task T011: Add the specified English create key schema in frontend/messages/en.json
Task T012: Add the identical Arabic create key schema in frontend/messages/ar.json
After all three: Task T013 implements creation form state in frontend/components/tasks.tsx
```

## Parallel Example: User Story 3

```text
Task T017: Implement stale-result and authentication-session guards in frontend/components/tasks.tsx
Task T018: Add selected-MindSpace keying in frontend/components/app-shell.tsx
After both: Task T019 verifies context isolation and authentication behavior
```

---

## Implementation Strategy

### MVP First: User Story 1

1. Complete Setup and Foundational tasks.
2. Implement T003-T008.
3. Run T009 and stop if the independent browse/empty/error criteria fail.
4. Demo the read-only Tasks section before adding creation complexity.

### Incremental Delivery

1. Setup + Foundation provide the exact API and translations.
2. User Story 1 delivers selected-MindSpace task browsing.
3. User Story 2 adds validated creation and authoritative revalidation.
4. User Story 3 hardens context and authentication-session isolation.
5. Polish completes accessibility, EN/AR, responsive, scope, and build validation.

### Minimal-Change Rules

- Modify only the six frontend files listed in `plan.md` unless a verified blocker requires otherwise.
- Add no frontend route, backend file, dependency, test framework, provider, global store, proxy, or generic API abstraction.
- Do not refactor existing Notes/Documents/Chat code while implementing Tasks.
- Preserve unrelated worktree changes and stop only for a direct conflict.

---

## Notes

- `[P]` tasks operate on different files and can be assigned concurrently.
- Story labels provide requirement traceability to `spec.md`.
- Verification tasks satisfy the explicitly requested tests using the repository's current frontend validation setup.
- A task is complete only after its stated implementation or recorded verification result exists at the named path.
