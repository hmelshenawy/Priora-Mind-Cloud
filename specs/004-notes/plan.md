# Implementation Plan: Notes

**Branch**: `main` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-notes/spec.md`

## Summary

Add a Notes area inside the existing protected `AppShell`. Pass the current MindSpace ID directly into one `Notes` component, keep the note list, selected note, creation form, and request states local to that component, and add one contract-specific API file for the three existing NestJS operations. Selection loads the authoritative note record; creation uses the persisted note returned by NestJS to add and open it immediately. No route, provider, global state, generic client, proxy, backend change, or dependency is introduced.

## Technical Context

**Language/Version**: TypeScript with Next.js 16 App Router

**Primary Dependencies**: Existing React 19, Next.js, and next-intl dependencies only

**Storage**: Existing auth and selected MindSpace `sessionStorage`; note state remains in memory and persisted notes remain owned by NestJS

**Testing**: Existing frontend typecheck/build scripts and manual scenarios; no frontend test framework exists, so none will be added

**Target Platform**: Web browsers on desktop and mobile

**Project Type**: Existing Next.js frontend backed by NestJS

**Performance Goals**: One note-list request per MindSpace selection, one single-note request per explicit existing-note selection, and one create request per valid submission; no polling or prefetching

**Constraints**: NestJS-only API calls; existing bearer auth and direct API base URL pattern; no `userId`; no global state, provider, generic client, proxy/rewrite, new dependency, or speculative synchronization

**Scale/Scope**: One current MindSpace, one selected note, finite note lists and plain-text content, and one creation request at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Simplicity: PASS. One API module and one Notes component are sufficient; no additional architecture is introduced.
- Readability: PASS. Contract calls remain separate from local UI state; files should remain below 300 lines and split only for a real presentation responsibility.
- API boundary: PASS. The frontend calls only the three existing NestJS Notes operations and no internal service directly.
- Backend authority: PASS. NestJS owns authentication, ownership, persistence, trimming, and ordering; the frontend sends no `userId`.
- User states: PASS. List, selection, and creation define loading, empty/idle, success, validation, unavailable, and safe error behavior.
- Accessibility and responsive design: PASS. Semantic lists, forms, labels, buttons, reading regions, logical CSS, and stacked mobile layout support keyboard use and EN/AR directionality.
- Dependencies and state: PASS. No dependency or global state is added; all Notes state remains local.
- Testing: PASS. Existing typecheck/build scripts and focused manual scenarios cover the feature without adding a test framework.

Post-design re-check: PASS. Phase 0 and Phase 1 retain direct contract calls, component-local state, existing authentication boundaries, request identity guards, and the smallest file structure.

## Project Structure

### Documentation (this feature)

```text
specs/004-notes/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── notes.md
└── tasks.md             # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
frontend/
├── app/
│   └── globals.css
├── components/
│   ├── app-shell.tsx          # Passes the valid current MindSpace ID to Notes
│   └── notes.tsx              # Local list, selection, creation, and request state
├── lib/
│   └── api/
│       └── notes.ts           # Three direct NestJS contract functions and types
└── messages/
    ├── en.json
    └── ar.json
```

**Structure Decision**: Add one contract-specific API file and one Notes component. Reuse `AppShell`, `AuthGate`, auth state, selected MindSpace state, locale layout, existing API base URL convention, and logout. Do not add a route, provider, custom hook, generic client, proxy/rewrite, service layer, or extra component unless `notes.tsx` approaches 300 lines and a distinct presentation responsibility justifies a split.

## Actual NestJS Notes Contracts Discovered

- List notes: `GET /api/v1/notes?mindSpaceId=<mindSpaceId>`. `mindSpaceId` is parsed as a UUID. NestJS verifies that the authenticated user owns the MindSpace and returns a raw `Note[]`, ordered by `updatedAt` descending.
- Create note: `POST /api/v1/notes` with `{mindSpaceId, title, content}`. All fields are required; `mindSpaceId` must be a UUID, and title/content must be non-empty strings. NestJS verifies MindSpace ownership, trims title/content while persisting, and returns the raw created `Note`.
- Get one note: `GET /api/v1/notes/:id`. NestJS verifies ownership through the note's MindSpace and returns the raw `Note`, or 404 when unavailable/not owned.
- A `Note` record contains `id`, `mindSpaceId`, `title`, `content`, `createdAt`, and `updatedAt`.
- All operations use the existing JWT bearer guard. The frontend sends no `userId` and performs no direct database or internal-service access.
- The frontend currently has no Next.js rewrite/proxy. Existing API modules call `NEXT_PUBLIC_NEST_API_BASE_URL`, defaulting to `http://localhost:3000/api/v1`; Notes will follow that exact pattern.
- Existing backend update and delete routes are out of scope and will not be called.

## State Ownership Approach

`AppShell` remains responsible for loading and selecting MindSpaces and renders `Notes` only with a valid `selectedId`. `Notes` owns only:

- the note list for the current MindSpace;
- the selected note ID and authoritative selected `Note` record;
- title and content creation inputs;
- list, selection, and creation statuses/errors;
- local request identities used to reject stale results.

No Notes state is persisted, shared globally, or stored in context. The existing `AuthGate` remains the protected-route boundary.

## Notes List Data Flow

1. `AppShell` passes the valid selected MindSpace ID to `Notes`.
2. `Notes` reads the existing access token and calls `listNotes(token, mindSpaceId)`.
3. The API function sends the exact `mindSpaceId` query key and returns the raw backend array without an envelope or normalization.
4. The component displays list loading, empty, success, or safe error state. Titles remain in backend `updatedAt` order.
5. The list does not auto-select a note; the reading area initially prompts the user to select one.

## Selected-Note Flow

1. Selecting a list button records the selected ID, clears any previously displayed note and selection error, and shows loading.
2. Call `getNote(token, noteId)` even though list records contain content, so the reading pane displays the endpoint's authoritative current title/content.
3. Accept the result only if the current MindSpace, selected ID, and request identity still match. Also require the returned `mindSpaceId` to match the current MindSpace before display.
4. On success, render title and plain-text content with line breaks preserved.
5. On 404, clear the selected record and show a translated unavailable state without removing the surrounding list. General failures show a safe translated error; unauthorized follows the shared auth behavior.

## Create-Note Approach

1. Keep labeled title and content controls in `Notes`; trim both values and reject either empty value before requesting.
2. While creation is active, disable submission to block duplicates while keeping the entered values visible.
3. Call `createNote(token, {mindSpaceId, title, content})` with trimmed values and no `userId`.
4. On success, verify the request still belongs to the current MindSpace, prepend the returned persisted note to the local list, set list status to success, select that note, and display the returned authoritative title/content without a redundant get-one request.
5. Clear inputs only after accepted success. On failure, preserve both inputs and show a safe translated error.

## MindSpace-Change Reset Behavior

When `mindSpaceId` changes, `Notes` synchronously invalidates all list, selection, and create request identities; clears the old list, selected ID/record, inputs, validation, unavailable state, and errors; resets active creation; then requests the new list. No prior note content remains visible while the new request is active.

## Stale-Request Protection Approach

- Keep the current MindSpace and selected note IDs in refs and use small monotonically increasing request counters for list, selection, and creation operations.
- Every success and failure handler compares its captured request ID and context with current refs before changing state.
- MindSpace change invalidates all three request categories; selecting another note invalidates the prior selection request.
- A stale create success is ignored entirely rather than inserting a note into a different MindSpace list.
- Do not add cancellation infrastructure, a data library, or synchronization layer.

## Loading, Empty, Unavailable, Error, And Unauthorized Handling

- List: loading, empty, success, and safe general error.
- Selection: idle guidance, loading, success, unavailable/404, and safe general error.
- Creation: field validation, active/disabled submit, success through immediate list/selection update, and safe request error with preserved inputs.
- Missing local token or any 401 response: clear auth and selected MindSpace state, then redirect to `/{locale}/login` using the established behavior.
- A list 404 means the current MindSpace is unavailable and is shown as a safe list error; selected-note 404 uses the explicit unavailable state.
- Raw backend messages are never displayed.

## Auth And Logout Integration

- Keep `AuthGate`, `AppShell` MindSpace loading/selection, and `AppShell` logout unchanged.
- `Notes` receives no token or auth provider; it reads the token with `getAuthState`, matching existing protected functionality.
- Unauthorized handling uses `clearAuthState`, `clearSelectedMindSpaceId`, and the locale-aware login redirect.
- No request sends `userId`; NestJS derives it from the JWT guard.

## EN/AR And RTL/LTR Handling

- Add matching Notes keys to `frontend/messages/en.json` and `frontend/messages/ar.json` for list, selection, reading, creation, validation, loading, unavailable, and safe errors.
- Reuse the locale layout's `lang` and `dir`; do not create component direction state.
- Use semantic controls and logical CSS such as `margin-inline` and `text-align: start`. Stack list/create and reading panes at the existing mobile breakpoint or another minimal breakpoint if content requires it.

## Validation Approach

- Trim title and content before submission.
- Require at least one non-whitespace character in each field, matching the current backend's effective required-field scope without inventing stricter lengths.
- Show translated validation for title, content, or both and send no request for invalid values.
- Keep NestJS authoritative for UUID validation, ownership, persistence, and final stored values.

## Test And Validation Approach

- Do not add a test framework because the frontend currently has only `typecheck` and `build` scripts.
- Run `npm run typecheck` and `npm run build` from `frontend/`.
- Manually validate auth gating; MindSpace-filtered raw list loading; list empty/error states; explicit selection and authoritative get-one content; unavailable note; title/content validation; duplicate-create prevention; create-and-open without reload; preserved inputs on failure; MindSpace reset; stale list/selection/create protection; 401 redirect; unchanged logout; EN/AR; LTR/RTL; keyboard operation; long plain text; and desktop/mobile layout.
- If frontend test tooling exists by implementation time, use it only for focused behavior coverage and add no new framework.

## Scope Confirmation

This plan introduces no global Notes state, context/provider, custom hook, generic API client, repository, adapter, factory, service layer, new auth framework, proxy/rewrite, dependency, route, edit/delete behavior, rich text or Markdown, tags, search, sort/filter controls, attachments, sharing, version history, Agent-specific UI, pagination, prefetching, or direct internal-service access.

## Complexity Tracking

No constitution violations. No complexity exceptions required.
