# Contract: Documents

All requests use the existing NestJS API base URL and `Authorization: Bearer <accessToken>`. No request sends `userId`. The frontend does not call storage or internal services directly.

## Contract Status

- Upload is an existing checked-in contract and is followed exactly.
- List is required by SPEC-005 but is absent from the checked-in controller/service. This plan adds the minimal contract described below.
- Delete exists but is excluded from the frontend feature.

## Public Document Metadata

The new list operation returns raw records shaped as:

```json
{
  "id": "document-uuid",
  "mindSpaceId": "mindspace-uuid",
  "fileName": "knowledge.pdf",
  "status": "PROCESSING",
  "createdAt": "2026-09-26T12:00:00.000Z",
  "updatedAt": "2026-09-26T12:00:00.000Z"
}
```

Actual backend status values are `PROCESSING`, `READY`, and `FAILED`. The frontend does not assign or transition them.

## List Documents - Required Addition

- Method: `GET`
- Path: `/api/v1/documents?mindSpaceId=<mindSpaceId>`
- Query: `mindSpaceId` is required and parsed as a UUID.
- Authentication: existing controller-level JWT guard.
- Response: raw public document metadata array, ordered by `createdAt` descending.
- Response envelope: none.

Backend behavior:

- Derives `userId` from the JWT.
- Verifies the user owns the requested MindSpace.
- Returns only records whose `mindSpaceId` matches that owned MindSpace.
- Selects `id`, `mindSpaceId`, `fileName`, `status`, `createdAt`, and `updatedAt`.
- Returns `[]` when the owned MindSpace has no documents.
- Returns 404 when the MindSpace does not exist or is not owned.

The checked-in backend does not currently provide this route. It must be added before the frontend list can work.

## Upload Document - Existing Contract

- Method: `POST`
- Path: `/api/v1/documents`
- Content type: `multipart/form-data`; the browser supplies the boundary.
- Binary field: `file`, exactly one file.
- Text field: `mindSpaceId`, required non-empty UUID.
- Authentication: existing controller-level JWT guard.
- `userId`: absent from the request; derived from JWT context.

Actual successful response:

```json
{
  "result": "users/user-id/mindspaces/mindspace-id/documents/generated-id.pdf",
  "documentMetaData": {
    "id": "document-uuid",
    "mindSpaceId": "mindspace-uuid",
    "fileName": "knowledge.pdf",
    "storageKey": "users/user-id/mindspaces/mindspace-id/documents/generated-id.pdf",
    "status": "PROCESSING",
    "createdAt": "2026-09-26T12:00:00.000Z",
    "updatedAt": "2026-09-26T12:00:00.000Z"
  }
}
```

Backend behavior as currently implemented:

- Requires the file bytes to begin with `%PDF-`.
- Verifies MindSpace ownership from the authenticated user.
- Persists the file and creates the document record.
- Defaults new records to `PROCESSING`.
- Returns the wrapper above; it does not return a flat document record.

Frontend behavior:

- Returns this payload unchanged from the upload API function.
- Ignores `result` and `documentMetaData.storageKey`.
- Inserts `documentMetaData` only when `id`, `mindSpaceId`, `fileName`, and `status` are strings and the MindSpace still matches.
- If metadata is incomplete, reports upload success but does not fabricate or insert a record.

## Error Contract

- `400`: invalid/missing body field or rejected PDF content; show safe upload/list text without raw backend details.
- `401`: for a current request, clear auth and selected MindSpace state and redirect to the locale login route.
- `404`: requested MindSpace is unavailable or not owned; show a safe list/upload error.
- Network or other non-success response: show a translated safe error.
- A stale response from a previous MindSpace, including 401, makes no current-context change.

## Excluded Existing And Proposed Operations

- `DELETE /api/v1/documents/:id`
- Get one document
- Retry processing
- Preview/download
- Poll processing status

## Boundary Rules

- Frontend calls NestJS only.
- Frontend sends no `userId`.
- Frontend displays backend-owned status and does not infer status.
- Frontend performs no direct Agent, RAG, Qdrant, PostgreSQL, Supabase, object storage, or other internal-service access.
- No generic client, response normalization layer, proxy, adapter, repository, or frontend service layer is introduced.
