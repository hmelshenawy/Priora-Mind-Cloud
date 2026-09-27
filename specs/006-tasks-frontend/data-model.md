# Data Model: Tasks Frontend

NestJS remains the source of truth. Frontend task data is request-scoped component state and is not persisted locally.

## Task

- `id`: stable task UUID.
- `mindSpaceId`: UUID of the owning MindSpace.
- `title`: backend-persisted plain-text title.
- `description`: optional plain-text description represented as a string or null.
- `executor`: backend-owned executor value; currently `USER` or `AGENT`.
- `status`: backend-owned status; currently `PENDING`, `PROGRESS`, `COMPLETED`, or `CANCELLED`.
- `createdAt`: backend creation timestamp.
- `updatedAt`: backend update timestamp.

Rules:

- A task is valid in the current UI context only when its `mindSpaceId` matches the current MindSpace.
- List order follows the backend response and is not re-sorted by the frontend.
- Title, executor, status, and creation date are displayed for each task; description is displayed only when non-empty.
- Known executor/status values receive translated labels; unfamiliar safe strings remain identifiable.
- Create responses are authoritative. Existing IDs are replaced in place; new IDs are prepended.
- A task ID appears at most once in local state.

## Current MindSpace

- `id`: stable UUID supplied by `AppShell` after existing ownership-aware MindSpace loading.

Rules:

- Tasks renders only when this identifier is valid and selected.
- This ID is the sole MindSpace value used by list and create operations.
- Changing it invalidates every in-flight Tasks request and clears all prior Tasks state before loading again.

## Task Draft

- `isOpen`: whether creation controls are active.
- `title`: controlled title input.
- `description`: controlled optional plain-text description.
- `executor`: controlled `USER` or `AGENT` selection; initially `USER`.
- `titleError`: translated title validation text or empty.
- `createError`: translated safe request error or empty.
- `createSucceeded`: transient translated success state or false.
- `isCreating`: duplicate-submission guard.

Rules:

- Trim title and description before validating and sending.
- The title must contain at least one non-whitespace character.
- A blank trimmed description is omitted from the create request.
- Invalid submission makes no request.
- Failed creation preserves title, description, and executor.
- Accepted creation clears and closes the draft after incorporating the returned task, then starts list revalidation.
- MindSpace change clears the draft regardless of its current state.

## Task List State

- `tasks`: current task records for one MindSpace.
- `listStatus`: `loading`, `empty`, `success`, or `error`.
- `listError`: translated safe request error or empty.
- `isRevalidating`: whether a post-create list refresh is active while current records remain visible.

Rules:

- `loading` contains no visible record from a previous MindSpace.
- `empty` means the accepted backend response contains no records and no accepted create is pending incorporation.
- `success` renders one or more de-duplicated records.
- `error` shows no stale previous-MindSpace records.
- Accepted creation invalidates any older list request before the task is inserted and revalidation begins.
- Successful revalidation replaces local records with its de-duplicated backend response in backend order.
- Failed post-create revalidation preserves the accepted task/current list and exposes a safe refresh error; it does not turn accepted creation into create failure.

## Request Context

- `expectedMindSpaceId`: MindSpace captured when a request begins.
- `listRequestId`: monotonically increasing identity for list work.
- `createRequestId`: monotonically increasing identity for create work.
- `currentMindSpaceId`: ref holding the currently rendered context.
- `requestAccessToken`: token captured when the request begins for authentication-session identity checks.

Rules:

- A data continuation may update UI only when its request identity is current and its expected MindSpace matches `currentMindSpaceId`.
- Stale success, non-authentication failure, and final cleanup continuations make no visible change.
- A 401 clears auth/MindSpace state and returns to locale login only when its captured token still matches the current authentication session; otherwise it belongs to a replaced session and is ignored.
- A create response must also name the expected MindSpace before local insertion.

## State Transitions

```text
MindSpace changes
  -> invalidate list/create requests
  -> clear list, draft, validation, success, and errors
  -> list loading
  -> empty | success | error

Create action opened
  -> draft open with USER executor
  -> editing

Invalid title submitted
  -> title validation
  -> zero request

Valid task submitted
  -> creating
  -> accepted success: insert-or-replace returned task -> close/clear draft -> success -> list revalidation
  -> failure: preserve draft -> safe error

Current-context revalidation finishes after accepted create
  -> replace local list with de-duplicated backend response in backend order
  -> success

Post-create revalidation fails
  -> preserve accepted task and current list
  -> safe refresh error

MindSpace changes during list/create
  -> old result ignored
  -> new context remains authoritative

Current unauthorized result
  -> clear auth and selected MindSpace state
  -> locale login
```
