# Quickstart: Documents

## Prerequisites

- Backend and frontend dependencies are already installed.
- Backend database and the existing upload storage configuration are available.
- `JWT_SECRET`, database configuration, and the current storage configuration are set for backend startup.
- `NEXT_PUBLIC_NEST_API_BASE_URL` points to the NestJS `/api/v1` base, or the existing localhost default is used.
- A test user can authenticate and owns at least two MindSpaces for context-switch testing.

## Automated Validation

Run the focused backend test and backend build:

```powershell
Set-Location backend
npm test -- documents.service.spec.ts
npm run build
```

Run frontend checks using existing tooling:

```powershell
Set-Location frontend
npm run typecheck
npm run build
```

No frontend test framework or new dependency is required.

## Contract Verification

1. Authenticate and retain the bearer access token.
2. Request `GET /api/v1/documents?mindSpaceId=<owned UUID>`.
3. Confirm the response is a raw array ordered newest first, each record contains only display metadata/timestamps, and no response envelope or `storageKey` is present.
4. Request the list for an unowned or unavailable MindSpace and confirm a safe 404 response.
5. Upload one real PDF as multipart fields `file` and `mindSpaceId`; do not include `userId`.
6. Confirm the actual upload response remains `{result, documentMetaData}` and nested metadata contains `id`, `mindSpaceId`, `fileName`, `status`, and timestamps.
7. Confirm non-PDF bytes are rejected by NestJS.

## Manual UI Scenarios

### List And Status

1. Open Documents with an owned current MindSpace and confirm loading changes to success or empty.
2. Confirm only that MindSpace's documents appear.
3. Confirm every row shows filename and backend-owned status.
4. Confirm known statuses are translated and an unfamiliar test status remains safely visible.
5. Force a request failure and confirm a translated safe error with no raw backend details.

### Upload Validation And Success

1. Submit without a file and confirm validation with zero network requests.
2. Select a non-`.pdf` file and confirm validation with zero upload requests.
3. Select a `.pdf` carrying an explicit non-PDF MIME and confirm rejection.
4. Select a `.pdf` with an empty browser MIME and confirm it may be submitted for backend validation.
5. Submit a valid PDF and confirm exactly one multipart request contains `file` and `mindSpaceId`, no `userId`, and a browser-generated multipart boundary.
6. Attempt another submission while active and confirm no duplicate request.
7. Confirm complete nested `documentMetaData` appears once in the list without reload and its backend status is shown.
8. Simulate successful but incomplete metadata and confirm success appears, the file clears, and no fabricated list item appears.
9. Force upload failure and confirm the file remains selected when possible and a safe error appears.

### MindSpace And Auth Safety

1. Start list loading in MindSpace A, switch to B, and complete A late; confirm A never appears in B.
2. Start upload in A, switch to B, and complete A late; confirm B's list, input, success, and errors do not change.
3. Confirm switching clears the old list, selected file, validation, upload activity, success, and errors before B loads.
4. Return a current 401 and confirm auth and selected MindSpace clear before locale-aware login redirect.
5. Return a stale 401 from A after switching to B and confirm it does not disrupt B.
6. Use logout from Documents and confirm existing logout behavior is unchanged.

### Accessibility, Locale, And Layout

1. Complete list reading and upload using keyboard only.
2. Confirm the file input has a visible label and validation association.
3. Confirm loading/success statuses are announced politely and errors use alert semantics.
4. Verify English LTR and Arabic RTL with matching content and behavior.
5. Verify long English and Arabic filenames wrap without horizontal page overflow.
6. Verify representative desktop and mobile widths, including the existing narrow breakpoint.

## Scope Check

Confirm there is no preview, delete/rename UI, drag-and-drop, multi-file selection, upload percentage, polling, retry, search, citations, retrieval UI, chat attachment, pagination, global Documents state, generic API client, proxy, direct internal-service call, or new dependency.
