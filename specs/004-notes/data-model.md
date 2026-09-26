# Data Model: Notes

NestJS remains the source of truth. Frontend data is request-scoped component state and is not persisted locally.

## Note

- `id`: stable note UUID.
- `mindSpaceId`: UUID of the owning MindSpace.
- `title`: trimmed plain-text title.
- `content`: trimmed plain-text body; embedded line breaks remain displayable.
- `createdAt`: backend creation timestamp.
- `updatedAt`: backend update timestamp.

Rules:

- A note is valid in the current UI context only when its `mindSpaceId` matches the current MindSpace.
- Creation requires title and content that each contain at least one non-whitespace character after trimming.
- List order follows the backend response, currently `updatedAt` descending.
- A selected existing note is replaced by the raw record returned from the get-one operation.
- A newly created note uses the complete persisted record returned by create.

## Current MindSpace

- `id`: stable UUID supplied by `AppShell` after existing ownership-aware MindSpace loading.

Rules:

- Notes renders only when this identifier is valid and selected.
- Changing this identifier invalidates every in-flight Notes request and clears all prior Notes state before loading again.

## Selected Note

- `selectedNoteId`: list-selected note identifier or null.
- `selectedNote`: authoritative loaded `Note` or null.
- `selectionStatus`: `idle`, `loading`, `success`, `unavailable`, or `error`.

Rules:

- `idle` displays selection guidance and no note content.
- Selection immediately clears the prior `selectedNote` before get-one loading.
- A successful record is displayed only when its ID, MindSpace, and request identity still match current state.
- `unavailable` represents a 404 or no-longer-accessible selected note while retaining the surrounding list.

## Creation Draft

- `title`: controlled title input.
- `content`: controlled plain-text content input.
- `titleError`: translated validation text or empty.
- `contentError`: translated validation text or empty.
- `createError`: translated safe request error or empty.
- `isCreating`: duplicate-submission guard.

Rules:

- Trim title and content before validating and sending.
- Invalid submission makes no request.
- Inputs remain visible during creation and after failure.
- Accepted success clears the draft, prepends the returned note, and selects/displays it.

## Local Notes State

- `mindSpaceId`: current prop from `AppShell`.
- `notes`: latest raw list for that MindSpace.
- `listStatus`: `loading`, `empty`, `success`, or `error`.
- selected-note state described above.
- creation draft and request state described above.
- request counters and current-context refs for stale-result protection.

## State Transitions

```text
MindSpace changes
  -> invalidate list/select/create requests
  -> clear list, selected note, draft, validation, and errors
  -> list loading
  -> empty | success | error

Existing note selected
  -> invalidate previous selection request
  -> clear previous selected record/error
  -> selection loading
  -> success | unavailable | error

Valid note submitted
  -> creating
  -> accepted success: prepend returned note -> select/display returned note -> clear draft
  -> failure: preserve draft -> safe error

Unauthorized result
  -> clear auth and selected MindSpace state
  -> locale login
```
