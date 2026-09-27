# Contract: Tasks Frontend

These are existing NestJS contracts. All requests use the configured NestJS API base URL and `Authorization: Bearer <accessToken>`. No request sends `userId`. Responses are raw JSON records or arrays with no envelope or generic frontend normalization layer.

## Task Record

```json
{
  "id": "task-uuid",
  "mindSpaceId": "mindspace-uuid",
  "title": "Prepare weekly review",
  "description": "Collect open decisions and follow-ups.",
  "status": "PENDING",
  "executor": "USER",
  "createdAt": "2026-09-27T12:00:00.000Z",
  "updatedAt": "2026-09-27T12:00:00.000Z"
}
```

`description` may be `null`. Current executor values are `USER` and `AGENT`. Current status values are `PENDING`, `PROGRESS`, `COMPLETED`, and `CANCELLED`.

## List Tasks

- Method: `GET`
- Path: `/api/v1/tasks?mindSpaceId=<mindSpaceId>`
- Query: `mindSpaceId` is required and parsed as a UUID.
- Response: raw `Task[]`, ordered by `updatedAt` descending.

Backend behavior:

- Derives the user from the JWT guard.
- Verifies that the authenticated user owns the requested MindSpace.
- Filters tasks to exactly that MindSpace.
- Returns an empty array when the owned MindSpace has no tasks.
- Returns 404 when the MindSpace is absent or unavailable to the authenticated user.

Frontend behavior:

- Sends the current shell-selected MindSpace ID and preserves response order.
- Accepts the response only while its request identity and MindSpace remain current.
- Does not display records from a previous MindSpace while loading or after failure.

## Create Task

- Method: `POST`
- Path: `/api/v1/tasks`
- Content type: `application/json`
- Body:

```json
{
  "mindSpaceId": "mindspace-uuid",
  "title": "Prepare weekly review",
  "description": "Collect open decisions and follow-ups.",
  "executor": "USER"
}
```

- Required fields: `mindSpaceId`, `title`.
- Optional fields: `description`, `executor`.
- Allowed executor values: `USER`, `AGENT`.
- Excluded fields: `userId`, `status`, `id`, `createdAt`, `updatedAt`, and undeclared properties.
- Response: raw persisted `Task` record with HTTP 201.

Frontend validation and shaping:

- Trim title and reject it without a request when the result is empty.
- Trim description and omit it when the result is empty.
- Send the controlled executor explicitly.
- Do not send status; NestJS and persistence own the default.

Backend behavior:

- Derives the user from the JWT guard and verifies MindSpace ownership.
- Trims title and supplied description before persistence.
- Defaults a newly inserted task to status `PENDING`; executor defaults to `USER` when omitted.
- May return an existing task when the same normalized title, description, and MindSpace match a record created in the prior two minutes. Executor is also matched when supplied; when omitted, current backend query behavior may not constrain executor. SPEC-006 always supplies executor explicitly.

Frontend response handling:

- Require the response to identify the expected current MindSpace before insertion.
- Replace a matching existing ID in place; prepend a new ID.
- Never fabricate missing fields or insert one task twice.
- Close and clear the form only for an accepted current-context success.
- Start one current-context list revalidation after accepted success while keeping the returned task visible.
- Replace the local list with a successful de-duplicated revalidation response in backend order; preserve the accepted task/current list if revalidation fails.

## Error Contract

- `400`: invalid/missing UUID, title, executor, field type, or non-whitelisted property; show safe translated validation/request text.
- `401`: when the request's captured token still matches current auth state, clear auth and selected MindSpace state and redirect to locale login, even if the originating request used a prior MindSpace. Ignore a 401 whose token belongs to a replaced authentication session.
- `404`: requested MindSpace is absent or unavailable to the authenticated user; show a safe list or creation error.
- `429`: request throttled; show a safe retry-later message if represented separately, otherwise the safe general request error.
- Network or other non-success response: show translated safe text without raw backend details.

## Excluded Existing Routes

- `GET /api/v1/tasks/:id`
- `PATCH /api/v1/tasks/:id`
- `DELETE /api/v1/tasks/:id`

SPEC-006 does not call these routes and does not expose task opening, editing, deletion, or status changes.

## Boundary Rules

- Frontend calls NestJS only.
- Frontend sends no `userId` and performs no ownership check beyond keeping the selected context isolated.
- Selecting executor `AGENT` does not call Agent or start task execution.
- Frontend performs no direct Agent, RAG, Qdrant, PostgreSQL, Supabase, storage, or other internal-service access.
- No generic client, proxy, response wrapper, adapter, repository, service layer, or new backend contract is introduced.
