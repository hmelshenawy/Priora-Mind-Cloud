# Tasks: Frontend Authentication

**Input**: Design documents from `/specs/001-frontend-authentication/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-ui-and-api.md, quickstart.md

**Tests**: Use existing frontend test tooling only. If no frontend test tooling exists, do not add a new test framework for this feature.

**Organization**: Tasks are grouped by user story so each story can be implemented and checked independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it affects different files and has no dependency on incomplete tasks
- **[Story]**: User story label for story phases only
- Every task includes exact file path(s), behavior, and acceptance check

## Phase 1: Setup (Shared Preconditions)

**Purpose**: Confirm existing project shape and avoid adding unnecessary dependencies or architecture.

- [X] T001 Inspect `frontend/`, `frontend/package.json`, `frontend/app/`, `frontend/messages/`, `frontend/middleware.ts`, `backend/src/auth/auth.controller.ts`, and `backend/src/auth/auth.service.ts`; acceptance: confirm existing Next.js/next-intl/test tooling, identify the API base URL config to reuse or minimally add, confirm NestJS login accepts email/password and returns data for frontend auth state, and do not add auth frameworks, global state libraries, or new test frameworks.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the smallest shared auth pieces required before user stories.

**CRITICAL**: No user story work should begin until this phase is complete.

- [X] T002 Create or update `frontend/lib/api/auth.ts` with minimal login request/response types if needed and a `login` function that POSTs email/password only to the NestJS login endpoint; acceptance: types match the existing backend response, successful responses are parsed, invalid credentials and network/server failures map to safe errors, and no generic API client or non-NestJS call is added.
- [X] T003 Create or update `frontend/lib/auth-state.ts` with `saveAuthState`, `getAuthState`, `clearAuthState`, and `isAuthenticated` using the simplest browser-side mechanism compatible with the current NestJS contract; acceptance: stores only returned access token and minimal user data, clears state on logout, and adds no refresh-token handling, provider, global state library, or session infrastructure.
- [X] T004 Create or update `frontend/app/[locale]/layout.tsx`, `frontend/messages/en.json`, and `frontend/messages/ar.json` with locale direction and auth message keys; acceptance: English uses `dir="ltr"`, Arabic uses `dir="rtl"`, and all login, validation, loading, error, protected landing, and logout text exists in EN and AR.

**Checkpoint**: Minimal API, auth-state, locale layout, and messages exist without new auth architecture.

---

## Phase 3: User Story 1 - Log In (Priority: P1) MVP

**Goal**: A logged-out user can enter email/password, submit login, see loading, avoid duplicate submit, and reach the protected landing page after success.

**Independent Test**: Submit valid credentials from `/{locale}/login` and confirm redirect to `/{locale}/app`; while loading, the submit button is disabled or otherwise prevents duplicate submit.

### Implementation for User Story 1

- [X] T005 [US1] Create `frontend/app/[locale]/login/page.tsx` with a localized, accessible, responsive email/password form; acceptance: page renders translated labels, inputs, submit button, required-field validation, keyboard submission, and mobile/desktop layout without adding a design system.
- [X] T006 [US1] Wire `frontend/app/[locale]/login/page.tsx` to `login` from `frontend/lib/api/auth.ts` and `saveAuthState` from `frontend/lib/auth-state.ts`; acceptance: valid login stores frontend auth state, redirects to `/{locale}/app`, shows loading while active, and prevents duplicate submissions.

**Checkpoint**: User Story 1 works independently for successful login and duplicate-submit prevention.

---

## Phase 4: User Story 2 - Handle Login Errors (Priority: P2)

**Goal**: A logged-out user sees safe, clear errors for invalid credentials and network/server failures.

**Independent Test**: Submit invalid credentials and simulate backend failure; confirm the user remains on login with translated error text and no authenticated state.

### Implementation for User Story 2

- [X] T007 [US2] Complete error handling across `frontend/lib/api/auth.ts` and `frontend/app/[locale]/login/page.tsx`; acceptance: invalid credentials and network/server failures show translated safe errors, raw backend details are not exposed, loading clears after failure, `saveAuthState` is not called, and error text is accessible with `role="alert"` or the existing project pattern.

**Checkpoint**: User Story 2 works independently for failed login paths.

---

## Phase 5: User Story 3 - Access Protected Areas (Priority: P3)

**Goal**: Authenticated users can open the protected landing page, while unauthenticated users are redirected to login.

**Independent Test**: Open `/{locale}/app` logged out and confirm redirect to login; log in and open the same route again and confirm it is accessible.

### Implementation for User Story 3

- [X] T008 [US3] Create `frontend/components/auth-gate.tsx` as a small client component using `isAuthenticated` from `frontend/lib/auth-state.ts`; acceptance: unauthenticated users are redirected to the locale-correct login route and authenticated users see child content.
- [X] T009 [US3] Create `frontend/app/[locale]/app/page.tsx` as a simple protected landing page wrapped by `frontend/components/auth-gate.tsx`; acceptance: page shows translated protected landing text only when authenticated and preserves English/Arabic locale behavior.

**Checkpoint**: User Story 3 works independently for protected route access.

---

## Phase 6: User Story 4 - Log Out (Priority: P4)

**Goal**: An authenticated user can clear frontend auth state and return to login.

**Independent Test**: Log in, trigger logout from the protected landing page, and confirm `/{locale}/app` redirects to login afterward.

### Implementation for User Story 4

- [X] T010 [US4] Add logout behavior in `frontend/app/[locale]/app/page.tsx` using `clearAuthState` from `frontend/lib/auth-state.ts`; acceptance: logout control uses translated text, clears frontend auth state, redirects to `/{locale}/login`, and reopening `/{locale}/app` redirects to login.

**Checkpoint**: User Story 4 works independently for logout and post-logout protection.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole feature without adding scope or architecture.

- [X] T011 If existing frontend test tooling is present, add minimal behavior tests in `frontend/tests/auth.test.tsx`; acceptance: tests cover successful login redirect, duplicate-submit prevention, invalid credentials, network error, protected redirect, logout clearing state, and EN/AR labels using only existing tooling; if no tooling exists, do not create this file and rely on quickstart validation.
- [X] T012 Run existing frontend lint/build/test commands from `frontend/package.json` and manual validation from `specs/001-frontend-authentication/quickstart.md`; acceptance: checks pass for English, Arabic, desktop, mobile, keyboard interaction, protected routing, and logout, and only feature-related issues are fixed in files touched by this feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Start first to confirm existing structure, tooling, and backend contract.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational and is the MVP.
- **User Story 2 (Phase 4)**: Depends on User Story 1 login form and API call.
- **User Story 3 (Phase 5)**: Depends on Foundational auth state and User Story 1 redirect target.
- **User Story 4 (Phase 6)**: Depends on User Story 3 protected landing page.
- **Polish (Phase 7)**: Depends on all desired user stories.

### User Story Dependencies

- **US1 Log In**: Required MVP and basis for auth state.
- **US2 Handle Login Errors**: Builds on US1 form and API flow.
- **US3 Access Protected Areas**: Uses auth state from Foundational and route destination from US1.
- **US4 Log Out**: Uses protected landing from US3.

### Parallel Opportunities

- T002, T003, and T004 can be worked on separately after T001 because they touch different files.
- T008 and T009 are sequential because the page depends on the guard.
- Most tasks are intentionally sequential to keep the implementation simple and avoid file conflicts.

---

## Parallel Example: Foundational

```text
Task: "T002 Create or update frontend/lib/api/auth.ts"
Task: "T003 Create or update frontend/lib/auth-state.ts"
Task: "T004 Create or update locale layout and messages"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001 setup checks.
2. Complete T002-T004 foundational auth API, auth state, locale layout, and messages.
3. Complete T005-T006 login success flow.
4. Stop and validate successful login and duplicate-submit prevention.

### Incremental Delivery

1. Add login success flow.
2. Add login error handling.
3. Add protected landing route.
4. Add logout.
5. Validate i18n, RTL/LTR, accessibility, responsiveness, and existing checks.

### Scope Guardrails

- Do not add auth frameworks, global state libraries, providers, factories, repositories, adapters, refresh-token infrastructure, or generic service layers.
- Do not add registration, password reset, social login, MFA, roles, permissions, profile, MindSpaces, Chat, Notes, Tasks, or Documents.
- Keep files small and split only when there is a clear responsibility boundary.
- Frontend calls NestJS only.
