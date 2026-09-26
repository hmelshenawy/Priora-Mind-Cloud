# Tasks: Documents

**Input**: Design documents from `/specs/005-mindspace-documents/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/documents.md`, `quickstart.md`

**Tests**: The frontend has no automated test framework. Use its existing typecheck/build scripts and the focused manual checks below; do not add test dependencies.

**Contract Update**: `GET /api/v1/documents?mindSpaceId=<uuid>` now exists, authenticates through `req.user.userId`, filters through the owned MindSpace, and returns documents ordered by `createdAt` descending. This update supersedes the earlier backend-gap sections in planning artifacts. No backend list route, service method, or backend test work is included here.

**Organization**: Tasks are grouped by user story so list, upload, and context-safety behavior can be implemented and checked incrementally.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its stated dependencies because it changes a different file.
- **[Story]**: Maps implementation work to the specification's user stories.
- Every task names its exact file path and an acceptance check.

## Phase 1: Setup

**Purpose**: Confirm the existing frontend baseline and constrain work to the resolved contracts.

- [X] T001 Confirm the existing direct NestJS API, auth-state, MindSpace selection, and locale patterns in `frontend/lib/api/notes.ts`, `frontend/components/notes.tsx`, `frontend/components/app-shell.tsx`, and `frontend/app/[locale]/layout.tsx`; acceptance: implementation proceeds without package changes, a new route, provider/context, global state, generic client, proxy, or backend edits.

---

## Phase 2: Foundational

**Purpose**: Create the shared Documents contract types and all translated text required by the three stories.

**Critical**: Complete this phase before story implementation.

- [X] T002 [P] Define `DocumentRecord`, the actual `{result, documentMetaData}` upload payload shape, `DocumentsApiError`, status-to-safe-error mapping, existing API base URL, and a feature-local authenticated request helper in `frontend/lib/api/documents.ts`; acceptance: types include actual list/upload fields, network/non-success failures become safe codes, no `userId` or generic client is introduced, and upload storage fields are represented only to follow the response contract rather than exposed to UI.
- [X] T003 [P] Add the complete `documents` English message namespace in `frontend/messages/en.json`; acceptance: keys cover list loading/empty/error, filename/status labels, known statuses, upload controls/active/success/error, missing-file validation, and invalid-PDF validation.
- [X] T004 [P] Add the key-for-key Arabic `documents` message namespace in `frontend/messages/ar.json`; acceptance: every English Documents key has a natural Arabic value and no direction-specific state or markup is embedded in messages.

**Checkpoint**: Shared contract types and EN/AR content are ready.

---

## Phase 3: User Story 1 - View MindSpace Documents (Priority: P1) MVP

**Goal**: Show only the selected MindSpace's documents with filenames and backend-owned processing statuses.

**Independent Test**: Open Documents for a MindSpace with records and one without records; verify the raw list contract produces loading then success/empty, only current-MindSpace filenames appear, and each status is visible.

- [X] T005 [US1] Implement `listDocuments(accessToken, mindSpaceId)` in `frontend/lib/api/documents.ts`; acceptance: it sends authenticated `GET /documents?mindSpaceId=<encoded id>`, expects the existing raw array without inventing an envelope, returns backend order unchanged, and sends no `userId`.
- [X] T006 [US1] Create the list-focused `Documents` component in `frontend/components/documents.tsx`; acceptance: it reads the existing auth state, loads on the supplied `mindSpaceId`, renders mutually clear loading/empty/success/safe-error states, shows `fileName`, translates `PROCESSING`/`READY`/`FAILED`, displays unknown backend status text safely, and follows established current-401 cleanup and locale-aware login redirect behavior.
- [X] T007 [US1] Import and render `<Documents key={selectedId} mindSpaceId={selectedId} />` only inside the valid selected-MindSpace branch in `frontend/components/app-shell.tsx`; acceptance: no Documents request or action exists without a valid MindSpace, and existing Chat, Notes, selector, AuthGate, and logout behavior remain unchanged.

**Checkpoint**: User Story 1 is independently usable as the MVP.

---

## Phase 4: User Story 2 - Upload One PDF (Priority: P2)

**Goal**: Upload exactly one validated PDF and immediately show complete returned document metadata without reloading.

**Independent Test**: Submit missing/invalid selections and confirm zero requests, then submit one valid PDF and confirm one multipart request, duplicate blocking, success feedback, and no-reload insertion from complete nested `documentMetaData`.

- [X] T008 [US2] Implement `uploadDocument(accessToken, mindSpaceId, file)` in `frontend/lib/api/documents.ts`; acceptance: it posts `FormData` with exactly `mindSpaceId` and `file` to `/documents`, does not manually set `Content-Type`, sends no `userId`, and returns the existing `{result, documentMetaData}` payload without flattening or normalization.
- [X] T009 [US2] Add the labeled single-file upload form and pre-request validation in `frontend/components/documents.tsx`; acceptance: the input accepts `.pdf,application/pdf` without `multiple`, missing files, non-`.pdf` names, and explicit non-PDF MIME types are rejected with associated translated validation and zero requests, empty MIME remains allowed for `.pdf`, and active upload disables/rejects duplicate submission.
- [X] T010 [US2] Complete upload result handling in `frontend/components/documents.tsx`; acceptance: a current successful response shows success and clears the accepted native/file state, complete nested metadata with string `id`, `mindSpaceId`, `fileName`, and `status` matching the current MindSpace is prepended once by ID, incomplete metadata adds nothing and fabricates nothing, `result`/`storageKey` are never rendered, and failure preserves the selected file where possible with a safe error.

**Checkpoint**: User Stories 1 and 2 list and upload documents without page reload or duplicate requests.

---

## Phase 5: User Story 3 - Preserve MindSpace And Session Context (Priority: P3)

**Goal**: Keep document state isolated across MindSpace, authentication, locale, and viewport changes.

**Independent Test**: Start list/upload work in MindSpace A, switch to B before completion, and verify immediate reset plus zero visible effects from late A success, failure, or unauthorized results.

- [X] T011 [US3] Add current-MindSpace refs and separate monotonic list/upload request identities in `frontend/components/documents.tsx`; acceptance: MindSpace change and cleanup invalidate both request categories, clear list/file/native input/validation/upload-active/success/error state before new loading starts, and every success, failure, unauthorized branch, and upload-finalizer verifies request identity plus expected MindSpace before changing state.
- [X] T012 [US3] Finalize semantic and localized Documents rendering in `frontend/components/documents.tsx`; acceptance: the section, form, input, list, status text, validation, and errors use semantic keyboard-accessible controls, visible labels, `aria-describedby`/`aria-invalid` where applicable, polite status announcements, alert semantics for errors, translated EN/AR text, and no component-owned LTR/RTL state.
- [X] T013 [US3] Add minimal logical and responsive Documents styles in `frontend/app/globals.css`; acceptance: the section follows the existing visual language, long English/Arabic filenames wrap with start alignment, controls remain usable at desktop and the existing mobile breakpoint, no horizontal overflow is introduced, and no physical-direction assumptions break RTL.

**Checkpoint**: All user stories are independently verifiable and context-safe.

---

## Phase 6: Polish And Cross-Cutting Validation

**Purpose**: Verify integration and scope without adding architecture.

- [X] T014 Run `npm run typecheck` from `frontend/`; acceptance: TypeScript completes successfully with the exact list/upload contract types and no generated type errors.
- [X] T015 Run `npm run build` from `frontend/`; acceptance: the production build completes successfully with both locales and the protected AppShell route.
- [ ] T016 Execute every manual validation item in `specs/005-mindspace-documents/tasks.md` against the completed frontend and existing NestJS endpoints; acceptance: all items pass or any failure is recorded with its exact scenario before implementation is considered complete.

**T016 validation record (2026-09-26)**: An unauthenticated request to the running `GET /api/v1/documents` endpoint returned `401`, confirming that the route and authentication guard are active. MV-01 through MV-16 require an authenticated test account, owned MindSpaces, controlled list/upload responses, PDF fixtures, and interactive browser accessibility/layout checks that are not available in this execution environment; these scenarios were not executed and T016 remains incomplete. MV-17 passed static scope inspection: no excluded capability, dependency, global state, proxy, generic client, or direct internal-service access was added.

---

## Dependencies And Execution Order

### Phase Dependencies

1. Phase 1 confirms the baseline and scope.
2. Phase 2 depends on Phase 1 and blocks all user-story work.
3. Phase 3 depends on Phase 2 and delivers the list MVP.
4. Phase 4 depends on Phase 3 because it extends the same API module, component, and visible list.
5. Phase 5 depends on Phases 3 and 4 because it hardens both request flows and finalizes shared UI behavior.
6. Phase 6 depends on all selected user stories.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 (list MVP) -> US2 (upload) -> US3 (context/i18n/a11y)
                                                   -> Polish and validation
```

- **US1**: First deliverable; depends only on the shared foundation.
- **US2**: Reuses and extends US1's API module, component, and visible list.
- **US3**: Applies reset/stale guards and cross-cutting presentation behavior to both list and upload.

### Task Execution Order

1. T001
2. T002, T003, and T004 in parallel
3. T005 -> T006 -> T007
4. T008 -> T009 -> T010
5. T011 -> T012 -> T013
6. T014 -> T015 -> T016

## Parallel-Safe Tasks

- T002, T003, and T004 can run in parallel after T001 because they create or update separate files.
- T003 and T004 must preserve identical message-key structure but do not modify the same file.
- No same-file tasks are marked parallel: T005/T008 share `frontend/lib/api/documents.ts`, and T006/T009/T010/T011/T012 share `frontend/components/documents.tsx`.
- User-story phases should remain sequential for a single implementer because later stories intentionally extend the same small component rather than introducing parallel abstractions.

## Parallel Example: Foundation

```text
Task T002: Define Documents contract types and errors in frontend/lib/api/documents.ts
Task T003: Add English Documents messages in frontend/messages/en.json
Task T004: Add Arabic Documents messages in frontend/messages/ar.json
```

## Implementation Strategy

### MVP First

1. Complete T001-T004.
2. Complete T005-T007 for User Story 1.
3. Stop and verify MindSpace-filtered list loading, empty, success, error, filename, and status behavior.

### Incremental Delivery

1. Add T008-T010 for one-PDF upload and immediate complete-metadata insertion.
2. Add T011-T013 for MindSpace race safety, session behavior, accessibility, localization, and responsive layout.
3. Run T014-T016 before completion.

## Manual Validation Checklist

- **MV-01 List context**: Open two MindSpaces and verify each raw list contains only its own documents in backend order.
- **MV-02 List states**: Observe one clear loading state followed by success, empty, or safe error; confirm no stale records remain during loading/error.
- **MV-03 Status authority**: Verify `PROCESSING`, `READY`, and `FAILED` translations and confirm an unknown status remains visible without frontend inference.
- **MV-04 Missing file**: Submit with no file and verify associated validation plus zero POST requests.
- **MV-05 Invalid PDF**: Verify a non-`.pdf` name and explicit non-PDF MIME each send zero requests; verify `.pdf` with empty MIME may reach backend validation.
- **MV-06 Multipart contract**: Upload a valid PDF and verify exactly `file` plus `mindSpaceId`, browser-generated multipart boundary, bearer auth, and no `userId`.
- **MV-07 Duplicate blocking**: Attempt repeated submission while active and verify exactly one upload request.
- **MV-08 Complete metadata**: Return complete nested `documentMetaData` and verify one no-reload list insertion with filename and returned status.
- **MV-09 Incomplete metadata**: Omit a required display field and verify success without insertion, fabrication, storage-path display, reload, or polling.
- **MV-10 Upload failure**: Force 400/404/network failure and verify a safe error plus preserved file selection where the browser permits.
- **MV-11 List race**: Complete MindSpace A's list after switching to B and verify no A state affects B.
- **MV-12 Upload race**: Complete A's upload success/failure/401 after switching to B and verify no list, file, success, error, active-state, or auth change in B.
- **MV-13 Current unauthorized**: Return current 401 from list/upload and verify existing auth and selected MindSpace cleanup followed by locale-aware login redirect.
- **MV-14 Logout**: Log out while viewing Documents and verify existing AppShell logout behavior is unchanged.
- **MV-15 Accessibility**: Complete list reading and upload with keyboard only; verify labels, focusable native controls, validation association, polite statuses, and alerts.
- **MV-16 Locale and layout**: Verify matching EN/AR behavior, inherited LTR/RTL, long filename wrapping, and usable desktop/mobile layouts.
- **MV-17 Scope**: Confirm no preview, delete/rename, drag-and-drop, multi-file upload, percentage, polling, ingestion retry, search, citations, RAG UI, chat attachments, pagination, global state, direct internal-service access, new dependency, or generic architecture was added.

## Backend Gap Resolution Confirmation

The previous document-list backend gap is resolved. `GET /api/v1/documents?mindSpaceId=<uuid>` is present and available for frontend use with authenticated ownership filtering and `createdAt` descending order. Tasks T001-T016 contain no backend route, service, DTO, repository, storage, or backend-test implementation work. If implementation discovers a real response mismatch, stop and document the observed contract before changing backend code; do not duplicate the existing list endpoint.
