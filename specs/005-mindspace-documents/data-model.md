# Data Model: Documents

## Document

Represents backend-owned metadata for one uploaded PDF in one MindSpace.

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Stable backend-generated identifier; required for a displayable upload result and list identity. |
| `mindSpaceId` | string | Required UUID; must match the active MindSpace before a returned upload may be inserted. |
| `fileName` | string | Original backend-persisted filename displayed to the user; never reconstructed from storage data. |
| `status` | `PROCESSING`, `READY`, `FAILED`, or backend string | Backend-owned processing state; displayed but never transitioned by the frontend. |
| `createdAt` | timestamp | Backend-generated; used by the list operation for newest-first ordering. |
| `updatedAt` | timestamp | Backend-generated metadata; no frontend update behavior in scope. |

The persisted backend record also has `storageKey`. It is required by backend storage behavior but is excluded from the new list response and never rendered or used by the frontend. The existing upload response currently includes it inside `documentMetaData`; the frontend ignores it.

### Relationships

- A Document belongs to exactly one MindSpace.
- Ownership is inherited through Document -> MindSpace -> authenticated User.
- The frontend never submits or stores a document `userId`.

### Processing State

```text
PROCESSING | READY | FAILED
```

SPEC-005 observes the current value only. It defines no transitions, polling, or retry behavior. Unknown future values remain displayable and are not converted to one of these values by the frontend.

## Current MindSpace

Represents the existing selected workspace context supplied by `AppShell`.

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Must be a valid selected MindSpace ID before Documents renders or requests data. |

The backend verifies that this MindSpace belongs to the authenticated user for list and upload operations.

## Selected File

Represents the temporary browser `File` chosen for upload.

| Property | Rule |
|----------|------|
| Cardinality | Zero or one selected file; multi-file selection is excluded. |
| Filename | Must end in `.pdf` case-insensitively before request. |
| Browser MIME | If present, must be `application/pdf`; an empty MIME is allowed with a valid extension. |
| Lifetime | Cleared on accepted success or MindSpace change; preserved on request failure when possible. |
| Persistence | Component memory and native input only; never global or session storage. |

Browser validation provides feedback only. NestJS remains authoritative for actual PDF signature, authentication, ownership, and persistence.

## UI State Models

### Document List

```text
loading -> success
loading -> empty
loading -> error
```

A MindSpace change immediately clears records and returns the new context to `loading`. A complete current-context upload can move `empty` or `error` to `success` by inserting the returned record.

### Upload

```text
idle -> validation error
idle -> active -> success
idle -> active -> error
active -> idle reset on MindSpace change
```

- `active` blocks another submit.
- Complete current-context metadata is inserted without reload.
- Incomplete metadata still produces upload success but no list insertion.
- Stale completion produces no state transition in the new context.

## Runtime Displayability Rule

Upload `documentMetaData` is complete enough for insertion only when all of these are true:

- `id` is a string.
- `mindSpaceId` is a string equal to the request's still-current MindSpace.
- `fileName` is a string.
- `status` is a string.

Missing timestamps do not block display because filename and processing status are the visible requirements. Missing required display fields are never synthesized.
