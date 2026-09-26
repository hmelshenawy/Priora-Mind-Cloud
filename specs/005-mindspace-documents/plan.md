# Implementation Plan: Documents

**Branch**: `005-mindspace-documents` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-mindspace-documents/spec.md`

## Summary

Add a Documents area inside the existing protected `AppShell` for listing the current MindSpace's documents and uploading one PDF. Keep list, file, validation, and request state in one frontend component; add one contract-specific API module; and add the missing authenticated NestJS list operation. Follow the existing upload contract exactly, including its `{result, documentMetaData}` response, while displaying only complete document metadata and never exposing storage fields in the UI.

## Technical Context

**Language/Version**: TypeScript with Next.js 16 App Router and NestJS 12

**Primary Dependencies**: Existing React 19, Next.js, `next-intl`, NestJS, Prisma, Multer, and class-validator dependencies only

**Storage**: Existing auth and selected MindSpace `sessionStorage`; document files and records remain backend-owned in the existing storage and database systems; Documents UI state remains in memory

**Testing**: Existing frontend typecheck/build scripts, existing backend Jest/build tooling for the new list behavior, and focused manual contract/UI scenarios; no new test framework

**Target Platform**: Web browsers on desktop and mobile, with the existing NestJS HTTP service

**Project Type**: Existing Next.js frontend backed by NestJS

**Performance Goals**: One document-list request per MindSpace selection and one upload request per valid submission; immediate local insertion only when upload returns complete current-context metadata; no polling, prefetching, or duplicate submissions

**Constraints**: NestJS-only frontend calls; existing bearer auth and API base URL pattern; multipart field names `file` and `mindSpaceId`; no `userId`; no direct storage or internal-service access; no global state, provider, generic client, normalization layer, new dependency, or speculative response shape

**Scale/Scope**: One current MindSpace, one selected PDF, finite document lists without complex pagination, and one active upload at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Simplicity: PASS. One backend list method/route, one contract-specific frontend API module, and one Documents component are sufficient.
- Readability: PASS. Backend ownership/list logic, direct API calls, and local UI state have focused responsibilities; files should remain below 300 lines.
- API boundary: PASS. The frontend calls NestJS only and never contacts storage, Supabase, RAG, Qdrant, PostgreSQL, or Agent directly.
- Backend authority: PASS. NestJS owns authentication, MindSpace ownership, persistence, PDF signature validation, ordering, and processing status; the frontend sends no `userId` and derives no processing status.
- User states: PASS. List and upload flows define loading, empty, success, validation, active, safe error, and unauthorized behavior.
- Accessibility and responsive design: PASS. Semantic list/form controls, labels, live status text, logical CSS, and a mobile layout support keyboard use and EN/AR directionality.
- Dependencies and state: PASS. No dependency or global state is added; Documents state remains local.
- Testing: PASS. Existing backend Jest/build and frontend typecheck/build tooling plus focused manual scenarios cover critical behavior without a new framework.

Post-design re-check: PASS. Phase 0 and Phase 1 retain direct contracts, backend authority, component-local state, request identity guards, existing auth/locale behavior, and the smallest required backend/frontend file set.

## Project Structure

### Documentation (this feature)

```text
specs/005-mindspace-documents/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── documents.md
└── tasks.md                  # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
backend/
└── src/documents/
    ├── documents.controller.ts       # Add owned-MindSpace list route
    ├── documents.service.ts          # Add ownership-checked metadata query
    └── documents.service.spec.ts     # Focused list behavior coverage

frontend/
├── app/
│   └── globals.css                   # Minimal Documents and mobile styling
├── components/
│   ├── app-shell.tsx                 # Render Documents for a valid selected ID
│   └── documents.tsx                 # Local list, upload, validation, and request state
├── lib/
│   └── api/
│       └── documents.ts              # Direct list/upload contract functions and types
└── messages/
    ├── en.json
    └── ar.json
```

**Structure Decision**: Add the missing list behavior in the existing Documents controller/service, one focused backend unit test, one frontend API file, and one Documents component. Reuse `AuthGate`, `AppShell`, selected MindSpace persistence, locale layout, API base URL convention, and logout. Do not add a route, DTO for the query, provider, custom hook, generic client, proxy, repository, adapter, factory, service layer, or extra UI component.

## Actual NestJS Documents Contracts Discovered

- The global prefix makes the controller's routes available under `/api/v1`.
- Existing upload: `POST /api/v1/documents`, protected by the controller-level JWT guard.
- Upload content: multipart form data with exactly one binary `file` field and one text `mindSpaceId` field. The DTO requires a non-empty UUID. `userId` comes from `req.user.userId` and is not a request field.
- Existing backend PDF validation checks the first five file bytes for `%PDF-`; this remains authoritative for actual content.
- Existing successful upload response is exactly `{result, documentMetaData}`. `result` is a storage key. `documentMetaData` is the persisted record containing `id`, `mindSpaceId`, `fileName`, `storageKey`, `status`, `createdAt`, and `updatedAt`.
- `documentMetaData` is a complete displayable record because it includes `id`, `mindSpaceId`, `fileName`, and `status`; the response itself is not a flat document record.
- Actual statuses are `PROCESSING`, `READY`, and `FAILED`; new records default to `PROCESSING`. This feature does not add status transitions or polling.
- Existing delete: `DELETE /api/v1/documents/:id`; it is out of scope and is not called.
- No list route or list service method currently exists. `GET /api/v1/documents?mindSpaceId=...` currently returns route-not-found, so list behavior cannot be delivered frontend-only.
- The minimal new list contract is an authenticated `GET /api/v1/documents?mindSpaceId=<uuid>`. NestJS parses the query as a UUID, verifies the authenticated user owns the MindSpace, and returns a raw array ordered by `createdAt` descending. Each item contains only `id`, `mindSpaceId`, `fileName`, `status`, `createdAt`, and `updatedAt`; there is no response envelope and no `storageKey`.

## Backend List Approach

1. Add `GET` and `Query` handling to the existing Documents controller and parse `mindSpaceId` with the existing UUID pipe.
2. Pass only `mindSpaceId` and the guarded `req.user.userId` to `DocumentsService.findAll`.
3. Verify the MindSpace exists for that user before querying documents, matching existing Notes and Tasks ownership behavior.
4. Return 404 for an unavailable or unowned MindSpace.
5. Query that exact `mindSpaceId`, order by `createdAt` descending, and select only display metadata and timestamps.
6. Return the raw array. Do not introduce an envelope, mapper, repository, or storage lookup.

## State Ownership Approach

`AppShell` remains responsible for loading/selecting MindSpaces and renders `Documents` only with a valid `selectedId`. `Documents` owns only:

- the current MindSpace's document list and list status;
- the selected `File` and native input reference;
- file validation, upload active/success/error state;
- current MindSpace and request identities used to reject stale results.

No Documents state is persisted, shared globally, or placed in context. `AuthGate` remains the protected-route boundary. `AppShell` passes only `mindSpaceId`, not auth or user data.

## Document List Data Flow

1. `AppShell` renders `Documents` with a valid selected MindSpace ID and a matching React key.
2. `Documents` clears previous local state, reads the existing access token, and calls `listDocuments(token, mindSpaceId)`.
3. The API function sends `GET /documents?mindSpaceId=<encoded id>` with the bearer token and returns the raw metadata array.
4. The component accepts the result only if its request identity and MindSpace still match.
5. Zero records produce the empty state; records produce the success list in backend order; failures produce a safe error or established unauthorized redirect.
6. Each item renders `fileName` and the exact backend-owned `status`, translating only known values while leaving an unknown value visible as safe text.

## Upload Approach And Multipart Handling

1. Use a labeled single-file input with `accept=".pdf,application/pdf"`; do not add `multiple` or drag-and-drop.
2. On valid submit, build `FormData`, append `mindSpaceId`, then append `file` using the exact backend field names.
3. Do not set `Content-Type`; the browser supplies the multipart boundary.
4. Send one authenticated `POST /documents` request and disable submission while it is active.
5. Return the backend response unchanged from the API function. Do not flatten `{result, documentMetaData}` or create a generic response normalizer.
6. After success, inspect only `documentMetaData`. Treat it as displayable only when `id`, `mindSpaceId`, `fileName`, and `status` are strings and its MindSpace matches the active request context.
7. If complete, prepend it while removing any existing item with the same ID, set list success, show upload success, and clear the accepted file/input.
8. If incomplete, still show upload success and clear the accepted file, but leave the list unchanged. Do not fabricate fields, use `result`, display `storageKey`, reload automatically, or poll.
9. On failure, preserve the selected file when the browser permits, clear active state, and show a translated safe error.

## PDF Pre-Request Validation

- Reject a missing selection.
- Require the filename to end in `.pdf`, case-insensitively.
- If the browser provides a MIME type, require `application/pdf`; allow an empty MIME type when the extension is valid.
- Invalid input sends no request and receives a translated validation message associated with the input.
- These checks improve immediate feedback but do not claim to verify file contents. NestJS remains authoritative through its `%PDF-` signature check and ownership validation.

## Authoritative Processing-Status Handling

- Render the status supplied by NestJS for list records and accepted upload metadata.
- Map the known `PROCESSING`, `READY`, and `FAILED` values to translated labels without changing their meaning.
- Render an unfamiliar backend value safely rather than replacing it with an inferred state.
- Do not use frontend upload activity to assign a document processing state.
- Do not poll, retry ingestion, or create status-transition behavior.

## MindSpace-Change Reset Behavior

When `mindSpaceId` changes, `Documents` invalidates list and upload request identities; updates the current-MindSpace ref; clears the prior list, selected file, native input value, validation, upload success/error, and active-upload state; sets list loading; then requests the new list. `key={selectedId}` in `AppShell` also remounts the component, but the internal guards keep the component safe if integration changes later.

## Stale-Request Protection Approach

- Keep the current MindSpace in a ref and use separate monotonically increasing counters for list and upload requests.
- Capture request ID and expected MindSpace before each request.
- Before handling success, failure, unauthorized, or final active-state cleanup, require both the current request identity and current MindSpace to match.
- MindSpace changes and effect cleanup increment both counters.
- Require returned upload metadata to name the expected MindSpace before insertion.
- Ignore stale upload success completely so it cannot clear the new selection, show success, or append a prior-MindSpace record.
- Do not add cancellation infrastructure, a query library, or synchronization layer.

## Loading, Empty, Success, Error, And Unauthorized Handling

- List: loading, empty, success, and safe general error are mutually clear states.
- Upload: missing/non-PDF validation, active disabled submission, accepted success, incomplete-metadata success without insertion, and safe failure with preserved selection.
- Missing local token or a current request's 401: clear auth and selected MindSpace state, then redirect to `/{locale}/login` using the established feature behavior.
- Stale 401 responses are ignored because they no longer belong to the current context.
- A list 404 or other non-401 failure is a safe list error; upload 400/404/network/other failures use the safe upload error.
- Raw backend messages, storage keys, and internal failure details are never displayed.

## Auth And Logout Integration

- Keep `AuthGate`, `AppShell` MindSpace loading/selection, and `AppShell.handleLogout` unchanged.
- `Documents` reads the token through `getAuthState`, matching Chat and Notes; it receives no token or user ID prop.
- Unauthorized handling calls `clearAuthState`, `clearSelectedMindSpaceId`, and the locale-aware login replacement.
- No request sends `userId`; NestJS derives identity from the JWT guard.

## EN/AR And RTL/LTR Handling

- Add matching `documents` keys to `frontend/messages/en.json` and `frontend/messages/ar.json` for titles, list states, upload labels/actions, validation, success/error, and known statuses.
- Reuse the locale layout's `lang` and `dir`; do not create component direction state.
- Use semantic form/list markup and logical CSS. Long filenames use start alignment and wrapping.
- Use one compact Documents section that remains readable at desktop widths and collapses cleanly at the existing mobile breakpoint.

## Validation Approach

- Frontend validates one selected file, `.pdf` extension, and any explicit browser MIME before requesting.
- Backend validates UUID shape, JWT authentication, ownership, and actual `%PDF-` file signature.
- The frontend validates upload metadata at runtime before inserting it because network responses are untrusted and the specification defines incomplete-response behavior.
- No arbitrary size limit, alternate MIME, or processing state is added because the current backend contract defines none.

## Test And Validation Approach

- Add a focused Documents service test with existing Jest tooling for owned-MindSpace filtering/order, safe selected fields, empty list, and unavailable/unowned MindSpace.
- Run `npm test -- documents.service.spec.ts` and `npm run build` from `backend/`.
- Run `npm run typecheck` and `npm run build` from `frontend/`; no frontend test framework or dependency is added.
- Manually validate auth gating; exact list query/filtering; list loading/empty/success/error; filename/status display; known and unknown statuses; missing file; invalid extension; explicit non-PDF MIME; empty MIME with `.pdf`; one multipart request with browser boundary; duplicate-submit prevention; actual nested upload response insertion; duplicate-ID prevention; incomplete response success without fabrication; failed upload preservation; MindSpace reset during list/upload; stale success/failure/401 protection; unchanged logout; EN/AR; LTR/RTL; keyboard operation; long filenames; and desktop/mobile layout.

## Scope Confirmation

This plan introduces no generic client, response envelope, normalization layer, global Documents state, context/provider, custom hook, repository, adapter, factory, service layer, new dependency, route page, proxy/rewrite, direct internal-service access, preview, delete/rename UI, drag-and-drop, multi-file upload, upload percentage, polling, ingestion retry, search, citations, RAG result UI, chat attachments, or complex pagination. The only backend addition is the missing authenticated list contract required to satisfy SPEC-005.

## Complexity Tracking

No constitution violations. No complexity exceptions required.
