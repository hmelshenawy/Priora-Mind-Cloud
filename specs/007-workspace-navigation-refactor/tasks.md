# Tasks: T034 Workspace Shell, Navigation & Chat UX Refactor

**Input**: Design documents from `/specs/007-workspace-navigation-refactor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/workspace-ui.md](./contracts/workspace-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Behavior-focused Playwright tests are required by the specification for routing, shell state, Chat containment/scrolling, mobile Sheets, RTL, onboarding, and legacy feature regressions.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing after the shared setup and foundational phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another incomplete task in the same phase
- **[Story]**: User story label for story phases only
- Every task includes exact repository-relative file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install and configure the approved Tailwind CSS and shadcn/ui foundation before workspace or Chat UI work begins.

- [X] T001 Add Tailwind CSS and approved shadcn/ui dependencies to `frontend/package.json` and `frontend/package-lock.json`
- [X] T002 Create Tailwind configuration for the Next.js 16 frontend in `frontend/tailwind.config.ts`
- [X] T003 Create Tailwind PostCSS configuration in `frontend/postcss.config.mjs`
- [X] T004 Update `frontend/app/globals.css` with Tailwind entry directives and Priora theme CSS variables without deleting existing legacy CSS
- [X] T005 Create shadcn/ui configuration in `frontend/components.json` for App Router, TypeScript, `@/*` aliases, and `frontend/components/ui`
- [X] T006 Create shadcn class-name utility in `frontend/lib/utils.ts`
- [X] T007 [P] Add shadcn Button primitive in `frontend/components/ui/button.tsx`
- [X] T008 [P] Add shadcn Sheet primitive in `frontend/components/ui/sheet.tsx`
- [X] T009 [P] Add shadcn Select primitive in `frontend/components/ui/select.tsx`
- [X] T010 [P] Add shadcn DropdownMenu primitive in `frontend/components/ui/dropdown-menu.tsx`
- [X] T011 [P] Add shadcn Avatar primitive in `frontend/components/ui/avatar.tsx`
- [X] T012 [P] Add shadcn Tooltip primitive in `frontend/components/ui/tooltip.tsx`
- [X] T013 [P] Add shadcn ScrollArea primitive in `frontend/components/ui/scroll-area.tsx` with a note in the file header that Chat message history may use native overflow instead

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish protected route boundaries, shared MindSpace context, messages, and test fixtures required by every story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T014 Create workspace selected-MindSpace provider and hook in `frontend/components/workspace-context.tsx`
- [X] T015 Refactor `frontend/components/app-shell.tsx` to accept active child content, provide selected MindSpace context, and stop mounting Documents/Chat/Notes/Tasks together
- [X] T016 Create protected workspace layout composing `AuthGate` and `AppShell` in `frontend/app/[locale]/app/layout.tsx`
- [X] T017 Replace `frontend/app/[locale]/app/page.tsx` content with a locale-preserving redirect to `/{locale}/app/chat`
- [X] T018 [P] Create thin Chat route adapter in `frontend/app/[locale]/app/chat/page.tsx`
- [X] T019 [P] Create thin Documents route adapter in `frontend/app/[locale]/app/documents/page.tsx`
- [X] T020 [P] Create thin Tasks route adapter in `frontend/app/[locale]/app/tasks/page.tsx`
- [X] T021 [P] Create thin Notes route adapter in `frontend/app/[locale]/app/notes/page.tsx`
- [X] T022 [P] Create Memories placeholder route in `frontend/app/[locale]/app/memories/page.tsx`
- [X] T023 Add English workspace, header, Sheet, Chat panel, and Memories strings to `frontend/messages/en.json`
- [X] T024 Add Arabic workspace, header, Sheet, Chat panel, and Memories strings to `frontend/messages/ar.json`
- [X] T025 Create shared Playwright mock helpers for auth, MindSpaces, conversations, messages, documents, tasks, and notes in `frontend/tests/workspace.spec.ts`
- [X] T026 Update onboarding route expectations for `/en/app` redirect behavior in `frontend/tests/onboarding.spec.ts`

**Checkpoint**: Foundation ready. The application has the approved Tailwind/shadcn setup, shared protected route boundary, and no active feature mounts without a validated MindSpace.

---

## Phase 3: User Story 1 - Navigate A Persistent Workspace (Priority: P1) 🎯 MVP

**Goal**: Authenticated users can navigate Chat, Documents, Tasks, Notes, and Memories through a persistent locale-aware shell while retaining the selected MindSpace.

**Independent Test**: Open `/{locale}/app`, follow every workspace link, use refresh/back/forward, and verify the active section, shell, locale, and selected MindSpace remain correct.

### Tests for User Story 1

- [ ] T027 [US1] Add Playwright test for `/en/app` redirect replacement, child route navigation, active `aria-current`, and back/forward behavior in `frontend/tests/workspace.spec.ts`
- [ ] T028 [US1] Add Playwright test for direct refresh on all five child routes and locale preservation in `frontend/tests/workspace.spec.ts`
- [ ] T029 [US1] Add Playwright test for selecting a second MindSpace and preserving it across at least Chat, Documents, Tasks, Memories, and refresh in `frontend/tests/workspace.spec.ts`

### Implementation for User Story 1

- [X] T030 [P] [US1] Implement Tailwind/shadcn workspace Sidebar with desktop navigation, active links, and mobile Sheet trigger in `frontend/components/workspace-sidebar.tsx`
- [X] T031 [P] [US1] Implement Tailwind/shadcn workspace Header with section title, MindSpace Select, email Avatar identity, account DropdownMenu/logout, and mobile menu Button in `frontend/components/workspace-header.tsx`
- [X] T032 [US1] Integrate `WorkspaceSidebar` and `WorkspaceHeader` into `frontend/components/app-shell.tsx`
- [X] T033 [US1] Add workspace root, column, main-content, Sidebar, Header, Sheet, and Priora token styles using Tailwind-compatible CSS variables in `frontend/app/globals.css`
- [X] T034 [US1] Ensure `frontend/components/app-shell.tsx` preserves MindSpace loading, empty onboarding, error, fallback selection, additional creation, persistence, and logout behavior after route navigation
- [X] T035 [US1] Verify route adapters in `frontend/app/[locale]/app/chat/page.tsx`, `frontend/app/[locale]/app/documents/page.tsx`, `frontend/app/[locale]/app/tasks/page.tsx`, `frontend/app/[locale]/app/notes/page.tsx`, and `frontend/app/[locale]/app/memories/page.tsx` render only active route content

**Checkpoint**: User Story 1 is independently functional and demonstrates the MVP persistent workspace shell.

---

## Phase 4: User Story 2 - Use Long Chats Without Losing Controls (Priority: P1)

**Goal**: Authenticated users can open and continue long Chat conversations without losing the Header, workspace navigation, conversation controls, message history, or composer.

**Independent Test**: Load long mocked conversations/messages, verify bounded workspace height, independent conversation/message scrolling, composer visibility, 80px near-bottom behavior, and stale/unmount protection.

### Tests for User Story 2

- [ ] T036 [US2] Add Playwright desktop Chat containment test for 50 conversations, 100 messages, viewport height tolerance, composer visibility, and no horizontal overflow in `frontend/tests/workspace.spec.ts`
- [ ] T037 [US2] Add Playwright independent overflow test for conversation and message scroll hosts in `frontend/tests/workspace.spec.ts`
- [ ] T038 [US2] Add Playwright Chat initial open and switch-conversation bottom-scroll test in `frontend/tests/workspace.spec.ts`
- [ ] T039 [US2] Add Playwright Chat 80px near-bottom and deliberate-upward-reading preservation tests in `frontend/tests/workspace.spec.ts`
- [ ] T040 [US2] Add Playwright Chat stale response, MindSpace switch, unmount cleanup, unauthorized, and 404 regression tests in `frontend/tests/workspace.spec.ts`

### Implementation for User Story 2

- [X] T041 [US2] Refactor `frontend/components/chat.tsx` into Tailwind/shadcn desktop layout with explicit conversation pane, message pane, message scroll host, and composer regions
- [X] T042 [US2] Implement Chat conversation create/list controls with shadcn Button and Tailwind states while preserving existing list/create contracts in `frontend/components/chat.tsx`
- [X] T043 [US2] Implement Chat message states, message list, and composer with Tailwind/shadcn controls while preserving existing message load/send contracts in `frontend/components/chat.tsx`
- [X] T044 [US2] Implement explicit native message scroll host refs and avoid shadcn ScrollArea for message history if it obscures `scrollTop`, `scrollHeight`, or `clientHeight` in `frontend/components/chat.tsx`
- [X] T045 [US2] Add complete bounded height, `min-h-0`, `min-w-0`, overflow, overscroll, and textarea growth constraints for Chat in `frontend/components/chat.tsx` and `frontend/app/globals.css`
- [X] T046 [US2] Implement the 80px near-bottom scroll policy, initial/switch bottom behavior, send-refresh bottom behavior, and reading-position preservation in `frontend/components/chat.tsx`
- [X] T047 [US2] Add Chat effect unmount cleanup that invalidates list, message, create, and send request identities in `frontend/components/chat.tsx`
- [X] T048 [US2] Preserve Chat unauthorized redirect, 404 active-conversation reset, stale request guards, validation, loading, empty, success, and safe error states in `frontend/components/chat.tsx`

**Checkpoint**: User Story 2 is independently functional with desktop Chat behaving like a bounded application surface.

---

## Phase 5: User Story 3 - Use Workspace And Chat On Mobile (Priority: P2)

**Goal**: Mobile users can use independent workspace and Chat conversation Sheets without permanent viewport-width consumption, horizontal overflow, or conversation-list displacement of the composer.

**Independent Test**: At 390x844, open/close workspace Sheet, navigate sections, open Chat conversation Sheet, select a conversation, send a message, verify focus behavior, RTL placement, and no horizontal overflow.

### Tests for User Story 3

- [ ] T049 [US3] Add Playwright mobile workspace Sheet open, focus, Escape, route activation, and focus-transfer test in `frontend/tests/workspace.spec.ts`
- [ ] T050 [US3] Add Playwright mobile Chat conversation Sheet open, select, close, and focus-transfer test in `frontend/tests/workspace.spec.ts`
- [ ] T051 [US3] Add Playwright mobile Sheet independence test ensuring workspace Sheet does not clear active Chat conversation, messages, or composer state in `frontend/tests/workspace.spec.ts`
- [ ] T052 [US3] Add Playwright Arabic RTL mobile Sheet placement and no-horizontal-overflow test in `frontend/tests/workspace.spec.ts`

### Implementation for User Story 3

- [X] T053 [US3] Complete shadcn Sheet-based mobile workspace navigation behavior, close handling, route activation handling, and RTL side placement in `frontend/components/workspace-sidebar.tsx`
- [X] T054 [US3] Add responsive Header behavior for mobile menu, compact email identity, MindSpace Select, and logout/account controls in `frontend/components/workspace-header.tsx`
- [X] T055 [US3] Implement Chat-local shadcn Sheet for mobile conversation create/list controls with independent state and distinct ARIA IDs in `frontend/components/chat.tsx`
- [X] T056 [US3] Add mobile Chat behavior to close the conversation Sheet after selection and focus the conversation heading or message region in `frontend/components/chat.tsx`
- [X] T057 [US3] Add mobile viewport, safe-area, touch target, no-horizontal-overflow, and RTL Sheet placement styling in `frontend/app/globals.css`
- [X] T058 [US3] Ensure workspace Sheet and Chat conversation Sheet state models remain independent in `frontend/components/app-shell.tsx`, `frontend/components/workspace-sidebar.tsx`, and `frontend/components/chat.tsx`

**Checkpoint**: User Story 3 is independently functional for mobile workspace and Chat usage in EN and AR.

---

## Phase 6: User Story 4 - Retain Existing Feature Behavior (Priority: P2)

**Goal**: Existing Documents, Tasks, Notes, logout, onboarding, and public auth pages keep working from the new workspace routes without full Tailwind/shadcn migration.

**Independent Test**: Exercise Documents, Tasks, Notes, onboarding, logout, direct unauthenticated route access, and public Login/Register pages while verifying existing API behavior and legacy CSS remain intact.

### Tests for User Story 4

- [ ] T059 [US4] Add Playwright regression for Documents route PDF validation/upload/list/status behavior using selected MindSpace in `frontend/tests/workspace.spec.ts`
- [ ] T060 [US4] Add Playwright regression for Tasks route list/create behavior and selected MindSpace continuity in `frontend/tests/workspace.spec.ts`
- [ ] T061 [US4] Add Playwright regression for Notes route list/create/open behavior and selected MindSpace continuity in `frontend/tests/workspace.spec.ts`
- [ ] T062 [US4] Add Playwright regression for empty-MindSpace onboarding, creation retry, creation success, and feature unlock after `/app` redirect in `frontend/tests/workspace.spec.ts`
- [ ] T063 [US4] Add Playwright regression for logout from a child route, unauthenticated direct child route redirect, and public Login/Register normal document scrolling in `frontend/tests/workspace.spec.ts`

### Implementation for User Story 4

- [ ] T064 [P] [US4] Verify Documents route wrapper renders `Documents` with shared selected MindSpace and no expanded document controls in `frontend/app/[locale]/app/documents/page.tsx`
- [ ] T065 [P] [US4] Verify Tasks route wrapper renders `Tasks` with shared selected MindSpace and no expanded task controls in `frontend/app/[locale]/app/tasks/page.tsx`
- [ ] T066 [P] [US4] Verify Notes route wrapper renders `Notes` with shared selected MindSpace and no expanded note controls in `frontend/app/[locale]/app/notes/page.tsx`
- [ ] T067 [US4] Apply only minimal wrapper spacing or overflow integration needed for legacy feature panels in `frontend/app/globals.css`
- [ ] T068 [US4] Ensure onboarding `CreateMindSpace` remains shell-owned and legacy-styled inside `frontend/components/app-shell.tsx`
- [ ] T069 [US4] Ensure public Login and Register pages remain outside workspace viewport containment in `frontend/app/globals.css`
- [ ] T070 [US4] Verify Memories placeholder remains non-functional and performs no API request in `frontend/app/[locale]/app/memories/page.tsx`

**Checkpoint**: User Story 4 is independently functional and confirms existing features were preserved without broad UI migration.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, dependency/scope review, and cleanup across all completed user stories.

- [X] T071 [P] Run `npm run typecheck` from `frontend` and fix type errors in changed frontend files
- [X] T072 [P] Run `npm run build` from `frontend` and fix build errors in changed frontend files
- [X] T073 Run `npm test` from `frontend` and fix failing workspace/onboarding Playwright scenarios in `frontend/tests/workspace.spec.ts` and `frontend/tests/onboarding.spec.ts`
- [X] T074 Review `frontend/package.json` and `frontend/package-lock.json` to confirm dependencies are limited to approved Tailwind/shadcn setup and selected primitive dependencies
- [X] T075 Review `frontend/components/chat.tsx` to confirm the actual message scroll host is directly measurable and shadcn ScrollArea does not obscure the Chat scrolling contract
- [X] T076 Review `frontend/app/globals.css` to confirm legacy CSS remains for existing screens and no global body overflow lock affects Login/Register
- [ ] T077 [P] Manually inspect EN desktop/mobile workspace and Chat visual identity against Priora warm/cream/dark/rounded style requirements using `frontend/app/[locale]/app/*`
- [ ] T078 [P] Manually inspect AR desktop/mobile workspace and Chat RTL behavior, Sheet placement, and no horizontal overflow using `frontend/app/[locale]/app/*`
- [X] T079 Run changed-file whitespace validation for `frontend/` and `specs/007-workspace-navigation-refactor/tasks.md`
- [X] T080 Confirm final scope excludes backend changes, profile/name/avatar support, Memories CRUD, expanded Documents/Tasks/Notes functionality, streaming Chat, unrelated component libraries, global state libraries, and full legacy UI migration in `specs/007-workspace-navigation-refactor/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts with Tailwind/shadcn foundation.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundation; MVP workspace navigation and shell.
- **User Story 2 (Phase 4)**: Depends on Foundation and should follow US1 shell integration for visual containment.
- **User Story 3 (Phase 5)**: Depends on US1 shell and US2 Chat structure.
- **User Story 4 (Phase 6)**: Depends on Foundation and can run after route wrappers exist; should be validated before final polish.
- **Polish (Phase 7)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Required MVP; no dependency on other user stories after Foundation.
- **US2 (P1)**: Can start after Foundation but is most efficient after US1 shell layout exists.
- **US3 (P2)**: Depends on US1 navigation structure and US2 Chat structure for mobile Sheets.
- **US4 (P2)**: Can start after Foundation once route wrappers exist; validates preservation of legacy features.

### Within Each User Story

- Write Playwright tests first and confirm they fail before implementation.
- Implement route/state/component changes before styling refinements.
- Preserve API contracts and existing behavior before visual polish.
- Complete each story's checkpoint before moving to lower-priority stories.

---

## Parallel Opportunities

- T007-T013 can run in parallel after dependency installation because each shadcn primitive is a separate file.
- T018-T022 can run in parallel because each route adapter is a separate file after `workspace-context.tsx` exists.
- T030 and T031 can run in parallel because Sidebar and Header are separate components.
- T064-T066 can run in parallel because Documents, Tasks, and Notes route wrappers are separate files.
- T071 and T072 can run in parallel only in separate working copies; otherwise run sequentially to avoid overlapping fixes.
- T077 and T078 can run in parallel as manual EN/AR inspection tasks.

---

## Parallel Example: User Story 1

```bash
# After Phase 2 foundation is complete, these can proceed in parallel:
Task: "Implement Tailwind/shadcn workspace Sidebar in frontend/components/workspace-sidebar.tsx"
Task: "Implement Tailwind/shadcn workspace Header in frontend/components/workspace-header.tsx"
```

## Parallel Example: User Story 4

```bash
# After route context is available, these route wrappers can be checked independently:
Task: "Verify Documents route wrapper in frontend/app/[locale]/app/documents/page.tsx"
Task: "Verify Tasks route wrapper in frontend/app/[locale]/app/tasks/page.tsx"
Task: "Verify Notes route wrapper in frontend/app/[locale]/app/notes/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Tailwind/shadcn setup.
2. Complete Phase 2 foundational route/context/message/test setup.
3. Complete Phase 3 User Story 1.
4. Validate `/en/app` and `/ar/app` redirect, child route navigation, active state, MindSpace continuity, and logout.
5. Stop and demo the persistent workspace shell before Chat containment work.

### Incremental Delivery

1. Setup + Foundation -> Tailwind/shadcn and route shell ready.
2. US1 -> Persistent workspace navigation MVP.
3. US2 -> Desktop bounded Chat with authoritative scroll behavior.
4. US3 -> Mobile workspace and Chat Sheets.
5. US4 -> Existing feature preservation and onboarding/public-page regressions.
6. Polish -> Full validation and scope/dependency review.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundation together.
2. Developer A implements US1 Sidebar/Header shell navigation.
3. Developer B implements US2 Chat containment after shell context is usable.
4. Developer C prepares US4 route-wrapper/legacy regression coverage after route adapters exist.
5. US3 starts after US1/US2 structures stabilize to avoid reworking mobile Sheet integration.

---

## Notes

- [P] tasks use different files and can run in parallel when dependencies are satisfied.
- [US1], [US2], [US3], and [US4] labels map to the prioritized user stories in `spec.md`.
- Tasks include tests where the T034 specification requires focused regression coverage.
- Do not implement backend changes, profile/avatar support, Memories CRUD, streaming Chat, unrelated UI libraries, global state libraries, or full legacy Tailwind migration.
