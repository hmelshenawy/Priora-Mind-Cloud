# Tasks: MindSpace App Shell

**Input**: Design documents from `/specs/002-mindspace-app-shell/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mindspaces-and-shell.md, quickstart.md

**Tests**: Use existing frontend test tooling only. No frontend test tooling currently exists, so do not add a test framework for this feature.

**Organization**: Tasks are grouped by user story and kept sequential where they touch the same files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it affects different files and has no dependency on incomplete tasks
- **[Story]**: User story label for story phases only
- Every task includes exact files, behavior, and an acceptance check

## Phase 1: Setup And Contract Confirmation

**Purpose**: Confirm the existing implementation before changing frontend behavior.

- [X] T001 Inspect `frontend/app/[locale]/app/page.tsx`, `frontend/components/auth-gate.tsx`, `frontend/lib/auth-state.ts`, `frontend/lib/api/auth.ts`, `frontend/messages/en.json`, `frontend/messages/ar.json`, `frontend/app/globals.css`, `backend/src/mindspaces/mindspaces.controller.ts`, and `backend/src/mindspaces/mindspaces.service.ts`; acceptance: confirm the actual NestJS MindSpaces response shape, bearer-token requirement, API base URL pattern, auth/session-storage lifetime, logout flow, and absence of frontend test tooling without adding dependencies or architecture.

---

## Phase 2: Foundational MindSpace Support

**Purpose**: Add only the direct API, selection persistence, and translated strings needed by the shell.

- [X] T002 Create `frontend/lib/api/mindspaces.ts` with minimal `MindSpace` and response types matching the actual backend shape found in T001 plus `getMindSpaces(accessToken)` using the existing NestJS API base URL; acceptance: sends `GET /mindspaces` with `Authorization: Bearer <token>`, sends no `userId`, returns the actual backend list without a new envelope or normalization adapter, and maps unauthorized versus general request failures safely.
- [X] T003 [P] Create `frontend/lib/mindspace-selection.ts` with direct helpers to read, save, and clear only the selected MindSpace ID using the same `sessionStorage` lifetime as `frontend/lib/auth-state.ts`; acceptance: helpers are browser-safe, use one separate storage key, and add no provider, context, global state, custom hook, or persistence abstraction.
- [X] T004 [P] Add app-shell, selector, loading, empty, error, current-MindSpace, and optional placeholder strings to `frontend/messages/en.json` and `frontend/messages/ar.json`; acceptance: both locales contain matching keys and no user-facing shell text needs to be hard-coded.

**Checkpoint**: The existing contract, selection storage, and translated shell text are ready without new infrastructure.

---

## Phase 3: User Story 1 - Enter The App Shell (Priority: P1) MVP

**Goal**: An authenticated user opens a protected shell and sees their MindSpaces loaded from NestJS.

**Independent Test**: Log in, open `/{locale}/app`, and confirm the branded shell loads only the authenticated user's MindSpaces; opening the route logged out still redirects to login.

### Implementation for User Story 1

- [X] T005 [US1] Create `frontend/components/app-shell.tsx` with a minimal branded shell that reads the access token through `getAuthState`, calls `getMindSpaces` once on mount using only necessary React state/effect, and renders the successful MindSpace list context; acceptance: data comes only from NestJS, no `userId` is sent, no custom hook/provider/global store is added, and the component stays below 300 lines.
- [X] T006 [US1] Update `frontend/app/[locale]/app/page.tsx` to keep the existing `AuthGate` and render `frontend/components/app-shell.tsx`; acceptance: authenticated users see the shell, unauthenticated users retain the locale-aware login redirect, and no duplicate auth logic or destination routes are introduced.

**Checkpoint**: User Story 1 provides a protected shell backed by the existing NestJS endpoint.

---

## Phase 4: User Story 2 - Select A Current MindSpace (Priority: P2)

**Goal**: The user can select one MindSpace, see its name, and retain a valid selection after refresh.

**Independent Test**: Select a MindSpace, refresh, and confirm it remains current; then simulate a stale stored ID and confirm the first returned MindSpace becomes current.

### Implementation for User Story 2

- [X] T007 [US2] Add selection behavior to `frontend/components/app-shell.tsx` using `frontend/lib/mindspace-selection.ts`; acceptance: a labeled selector updates local state and stored ID, the current name is visible, a valid stored ID is restored, a missing or stale ID falls back to and stores the first returned MindSpace, and an empty list clears the stored ID without a backend write.

**Checkpoint**: User Story 2 provides deterministic selection, refresh persistence, and stale-selection recovery.

---

## Phase 5: User Story 3 - Understand Non-Success States (Priority: P3)

**Goal**: The shell clearly handles loading, empty, error, and unauthorized responses.

**Independent Test**: Exercise a delayed request, empty list, failed request, and unauthorized response and confirm each produces the expected safe behavior.

### Implementation for User Story 3

- [X] T008 [US3] Complete request-state handling in `frontend/components/app-shell.tsx` and `frontend/lib/api/mindspaces.ts`; acceptance: loading text appears during the request, empty state has no CRUD controls, general failures show a translated safe error without backend details, success shows the selector/current name, and unauthorized responses clear auth plus selected MindSpace state and return to the locale login route.

**Checkpoint**: User Story 3 provides all required data states without exposing backend internals.

---

## Phase 6: Polish And Integration

**Purpose**: Preserve logout, localization, accessibility, and responsive behavior without adding scope.

- [X] T009 Update logout integration in `frontend/components/app-shell.tsx`, `frontend/lib/auth-state.ts` only if needed, and `frontend/lib/mindspace-selection.ts`; acceptance: logout reuses `clearAuthState`, clears the selected MindSpace ID, redirects to `/{locale}/login`, and adds no backend logout or new auth behavior.
- [X] T010 Update `frontend/components/app-shell.tsx` and `frontend/app/globals.css` for accessible and responsive EN/AR behavior; acceptance: selector and logout have clear labels and keyboard operation, logical layout works in inherited LTR/RTL direction on desktop and mobile, optional navigation placeholders remain non-functional if included, and no out-of-scope routes or screens are added.
- [ ] T011 Run `npm run typecheck` and `npm run build` from `frontend/`, then complete `specs/002-mindspace-app-shell/quickstart.md`; acceptance: available automated checks pass and manual validation covers auth protection, actual contract loading, selection, refresh, stale fallback, empty/error/unauthorized states, logout clearing selection, EN/AR, RTL/LTR, keyboard use, and desktop/mobile layout; do not add tests because no existing frontend test tooling is available.

---

## Dependencies And Execution Order

### Phase Dependencies

- **Setup**: T001 must complete first because it confirms the actual contract and existing patterns.
- **Foundational**: T002-T004 depend on T001 and block shell implementation.
- **US1**: T005 depends on T002 and T004; T006 depends on T005.
- **US2**: T007 depends on T003 and the shell from T005.
- **US3**: T008 depends on the API function and shell request flow.
- **Polish**: T009-T011 follow all user-story behavior.

### User Story Dependencies

- **US1 Enter The App Shell**: MVP; establishes protected shell and data loading.
- **US2 Select A Current MindSpace**: Uses the US1 list and foundational selection helpers.
- **US3 Understand Non-Success States**: Completes the request flow created by US1.

### Parallel Opportunities

- T003 and T004 can run in parallel after T001 because they affect separate files.
- T002 may run alongside T003 and T004 once T001 confirms the contract, but sequential execution is preferred for one implementer.
- Remaining tasks are intentionally sequential because they converge on `app-shell.tsx`.

---

## Parallel Example: Foundational

```text
Task: "T002 Create frontend/lib/api/mindspaces.ts"
Task: "T003 Create frontend/lib/mindspace-selection.ts"
Task: "T004 Add EN/AR app-shell messages"
```

---

## Implementation Strategy

### MVP First

1. Complete T001 contract and project inspection.
2. Complete T002-T004 foundations.
3. Complete T005-T006 protected shell and MindSpace loading.
4. Stop and validate User Story 1 independently.

### Incremental Delivery

1. Add protected shell and loading from NestJS.
2. Add selection persistence and stale fallback.
3. Complete loading, empty, error, and unauthorized states.
4. Integrate logout clearing, accessibility, responsive styling, and final validation.

### Scope Guardrails

- Do not add a generic API client, response adapter, provider, context, global state library, custom hook, repository, factory, service layer, or new dependency.
- Do not send `userId` or call any service other than NestJS.
- Do not add MindSpace CRUD or product destination screens.
- Keep optional navigation placeholders non-functional.
