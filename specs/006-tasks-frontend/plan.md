# Implementation Plan: Tasks Frontend

**Branch**: `006-tasks-frontend` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-tasks-frontend/spec.md`

## Summary

Add a Tasks section to the existing protected MindSpace application shell. The frontend will call the existing authenticated NestJS list and create endpoints through one contract-specific API module, keep task list and creation state local to one component, preserve backend ordering, and reject stale results when the selected MindSpace changes. Creation will show the returned persisted record immediately, de-duplicate by task ID, and revalidate the list without a page reload. No backend change, new route, dependency, global state, or advanced task-management capability is required.

## Technical Context

**Language/Version**: TypeScript with Next.js 16 App Router and React 19

**Primary Dependencies**: Existing Next.js, React, and `next-intl` dependencies only

**Storage**: Existing auth and selected MindSpace `sessionStorage`; task persistence remains backend-owned; Tasks UI state remains in component memory

**Testing**: Existing frontend `typecheck` and production `build` scripts plus focused browser scenarios; no frontend test framework currently exists and none will be added for this feature

**Target Platform**: Web browsers on desktop and mobile

**Project Type**: Existing Next.js frontend backed by NestJS

**Performance Goals**: One normal initial list operation per mounted MindSpace context; one create request and one list revalidation per successful valid submission; immediate visible incorporation of an accepted create response; no polling, prefetching, caching, or duplicate submissions

**Constraints**: NestJS-only frontend calls; existing bearer authentication and API base URL convention; exact `mindSpaceId` contract; no `userId` or frontend-defined status; English LTR and Arabic RTL; preserve backend list order; no new dependency, backend change, global state, generic client, or direct Agent call

**Scale/Scope**: One current MindSpace, finite task lists without pagination or filters, one creation form, and one active creation request at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Simplicity: PASS. One API module, one Tasks component, and existing shell/message/style updates are sufficient; the single post-create revalidation is explicitly required and reuses the same list operation.
- Readability: PASS. The API contract and component-local UI/request state have focused responsibilities; the new component is expected to remain below 300 lines without speculative extraction.
- API boundary: PASS. The frontend calls only existing NestJS Tasks endpoints and never contacts Agent, RAG, Qdrant, PostgreSQL, Supabase, storage, or other internal services.
- Backend authority: PASS. NestJS remains authoritative for authentication, ownership, persistence, default status, default executor, ordering, and create deduplication; the frontend sends no `userId` or status.
- User states: PASS. List loading, empty, success, and error states and create idle, validation, submitting, success, and failure states are defined.
- Accessibility and responsive design: PASS. Semantic section/form/list markup, labels, keyboard controls, live status text, logical CSS, mobile behavior, and EN/AR directionality are planned.
- Dependencies and state: PASS. No dependency or global state is added; task data and request state remain local to Tasks.
- Testing: PASS. Existing typecheck/build tooling and focused behavior scenarios cover the important flows without adding a testing architecture solely for this feature.

Post-design re-check: PASS. Phase 0 and Phase 1 retain the direct NestJS contracts, local state, backend authority, stale-request guards, existing auth/i18n behavior, and smallest source change set. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/006-tasks-frontend/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── tasks.md
└── tasks.md                  # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
frontend/
├── app/
│   └── globals.css           # Minimal Tasks and mobile styling
├── components/
│   ├── app-shell.tsx         # Render Tasks for a valid selected MindSpace
│   └── tasks.tsx             # Local list, form, validation, and request state
├── lib/
│   └── api/
│       └── tasks.ts          # Exact list/create contracts and safe errors
└── messages/
    ├── en.json
    └── ar.json
```

**Structure Decision**: Add one contract-specific API file and one Tasks component, then integrate them into the existing shell and translations/styles. Reuse `AuthGate`, selected MindSpace persistence, bearer auth, locale layout, and logout. Do not add a route page, provider, context, custom hook, generic client, proxy, repository, adapter, response envelope, or backend file.

## Existing NestJS Tasks Contracts

- The global prefix exposes Tasks under `/api/v1`; the controller-level JWT guard protects every operation.
- List: `GET /api/v1/tasks?mindSpaceId=<uuid>` returns a raw task array after verifying the authenticated user owns that MindSpace.
- List order is `updatedAt` descending. The frontend preserves this response order and adds no client-side sorting control.
- Create: `POST /api/v1/tasks` accepts JSON `{mindSpaceId, title, description?, executor?}` and returns the raw persisted task with HTTP 201.
- Create accepts executor values `USER` and `AGENT`; the backend default is `USER`. Selecting `AGENT` stores metadata only and does not invoke Agent.
- Task statuses are `PENDING`, `PROGRESS`, `COMPLETED`, and `CANCELLED`; `PROGRESS`, not historical `IN_PROGRESS`, matches the actual schema.
- A task record contains `id`, `mindSpaceId`, `title`, nullable `description`, `status`, `executor`, `createdAt`, and `updatedAt`.
- The backend trims title and supplied description. The UI still rejects a whitespace-only title because DTO validation occurs before backend trimming.
- Create may return a matching task from the previous two minutes instead of inserting another record. The returned ID may therefore already be visible.
- Missing/invalid input returns 400, invalid authentication returns 401, unavailable/unowned MindSpace returns 404, throttling may return 429, and network/service failures remain possible.
- Get-one, update, and delete endpoints exist but are outside SPEC-006 and are not called.

## State Ownership

`AppShell` remains responsible for loading and selecting owned MindSpaces. It renders `Tasks` only with a valid `selectedId` and passes only `mindSpaceId`. `Tasks` owns:

- current-MindSpace task records and list status;
- form visibility, title, description, executor, and validation;
- create submitting/success/error state;
- current MindSpace and separate list/create request identities used to reject stale continuations.

No Tasks state is persisted or shared globally. `AuthGate` remains the protected-route boundary, while Tasks handles server-reported 401 responses consistently with Notes and Documents.

## Task List Flow

1. `AppShell` renders `Tasks` with a valid selected MindSpace ID and a selection-specific React key.
2. Tasks immediately clears prior-context state, reads the existing access token, and calls the list contract with that exact `mindSpaceId`.
3. The API module sends the bearer-authenticated query and returns the raw array without sorting or normalization.
4. The component accepts list success or non-authentication failure only while both the list request identity and expected MindSpace remain current. A 401 follows existing logout behavior only when the request's captured access token still identifies the current authentication session.
5. Zero records produce the empty state; records produce the success list in backend order; failures produce a translated safe error or established unauthorized redirect.
6. Cards render title, non-empty description when present, executor, status, and a locale-formatted creation date. Known enum values are translated; unfamiliar safe strings remain visible.

## Create Flow

1. A simple Create Task action exposes the labeled form with default executor `USER`.
2. Submission trims the title and description. A blank trimmed title shows field validation and sends no request. A blank trimmed description is omitted.
3. A valid request sends exactly `mindSpaceId`, trimmed title, optional trimmed description, and the selected `USER` or `AGENT` executor. It never sends `userId` or status.
4. Submission is disabled while active so repeated actions cannot create another request.
5. An accepted response is used only when its request identity and MindSpace still match and the returned record identifies that same MindSpace.
6. If the returned ID already exists, replace that item in its current position. If it is new, prepend it. This displays the accepted task once without moving an older backend-deduplicated record or sorting the list.
7. Accepted success closes the form, clears its draft/validation/error state, announces success, and starts a background list revalidation while keeping the accepted task visible.
8. Revalidation replaces the current task array with the accepted backend response in backend order. A revalidation failure preserves the accepted task and current list and presents a safe refresh error without converting successful creation into failure.
9. Create failure preserves the draft and executor, clears submitting state, and shows a translated safe error.

## Concurrent List And Create Handling

- Keep separate monotonically increasing request counters and the current MindSpace in a ref.
- Every non-authentication asynchronous continuation checks its request ID and expected MindSpace before changing UI or clearing active state. A 401 compares the request's captured token with current auth state so it applies across MindSpace changes in the same session but cannot clear a replaced session.
- A MindSpace change invalidates both counters immediately.
- Accepted creation invalidates any older current-context list request before inserting the returned record and starting revalidation. The older list therefore cannot erase accepted success.
- Successful revalidation replaces local records with its raw de-duplicated response in backend order. Failed revalidation preserves the accepted create response and current records.
- A create response for an old MindSpace is ignored completely, including success/error announcements and form cleanup.
- No cancellation framework, query library, cache, or synchronization layer is introduced.

## MindSpace Change Reset

When `mindSpaceId` changes, Tasks invalidates list and create identities, updates the current-MindSpace reference, clears the old task list, closes and resets the form, clears validation/success/errors/submitting state, sets list loading, and requests the new list. The shell key also remounts Tasks, but internal guards preserve correctness if integration changes later.

## Error And Authentication Handling

- List states are mutually clear: loading, empty, success, or safe general error.
- Create states distinguish local title validation, active submission, accepted success, and safe failure with preserved input.
- Safe API error codes follow existing modules. Raw backend bodies, validation internals, ownership details, and stack information are never displayed.
- Missing local auth clears auth/MindSpace state and returns to locale login. A Tasks 401 does the same only when the request's captured token still matches current auth state; a 401 from a replaced session is ignored.
- Current 400, 404, 429, network, and other failures map to translated user-friendly list or creation errors.

## Internationalization, Accessibility, And Layout

- Add matching `tasks` keys to English and Arabic messages for section/list states, form controls, validation, success/error text, metadata labels, both executors, and all four known statuses.
- Reuse the locale layout's `lang` and `dir`; no component direction state is added.
- Use semantic section, form, list, labels, native controls, field-associated validation, `aria-live`, and alert semantics following Notes/Documents.
- Use a locale-aware date formatter and a safe fallback for an invalid timestamp so one record cannot break the section.
- Use logical CSS, start alignment, wrapping, and preserved description line breaks. The compact layout collapses at the existing mobile breakpoint.

## Validation And Runtime Trust

- Frontend validation is limited to the specified non-whitespace title and controlled executor values; NestJS remains authoritative for all other validation and ownership rules.
- The API types mirror the raw NestJS request and response fields without a generic abstraction.
- Before local insertion, minimally verify that the create response has string identity/display fields and the expected `mindSpaceId`. Do not fabricate missing fields.
- Do not derive task status, executor, timestamps, ownership, or create success from frontend state.

## Test And Validation Approach

- No frontend test runner is configured. Do not add one solely for SPEC-006; use existing `npm run typecheck` and `npm run build` checks plus the behavior-focused browser scenarios in `quickstart.md`.
- Verify rendering, the selected MindSpace query, existing records, empty state, title validation with zero request, both executor payloads, active-submit protection, successful create insertion/revalidation, duplicate-ID behavior, safe errors, MindSpace reset, stale non-authentication response isolation, 401 cleanup, EN/AR, keyboard operation, and desktop/mobile layout.
- The backend is unchanged. Its existing build may be run as an optional contract confidence check, but no backend test file is added for a frontend-only feature.
- `git diff --check` validates generated and implementation changes for whitespace errors.

## Scope Confirmation

This plan introduces no task route page, get-one UI, editing, deletion, status mutation, drag-and-drop, board, kanban, recurring task, reminder, notification, scheduling, subtask, priority, tag, filter, search, AI planning, Agent invocation, background worker, automation, pagination, generic client, global Tasks state, provider, proxy, new dependency, or backend architecture. Existing backend behavior is consumed unchanged.

## Complexity Tracking

No constitution violations. No complexity exceptions required.
