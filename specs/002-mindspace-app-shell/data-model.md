# Data Model: MindSpace App Shell

The backend remains the source of truth. The frontend holds only the latest returned list and one selected ID.

## MindSpace

Fields consumed by the frontend:

- `id`: stable string identifier from NestJS.
- `name`: display name shown in the selector and shell.

The actual backend response may include additional fields. The frontend does not modify or persist MindSpace records.

## MindSpaces Response

The implementation must inspect and match the existing NestJS response shape. It must not introduce a new response envelope or an adapter solely to normalize the contract.

Validation rules:

- Treat the MindSpace list in the actual NestJS response as the authoritative selectable list.
- Do not send or derive `userId` in the frontend request.
- Do not duplicate ownership checks in the frontend.

## Current MindSpace Selection

- `selectedMindSpaceId`: ID of the current MindSpace, or absent when no selection exists.

Rules:

- Persist only the ID using the existing browser session storage approach.
- A selection is valid only if its ID exists in the latest returned MindSpace list.
- Keep a valid stored ID.
- Replace a missing or stale ID with the first returned MindSpace ID.
- Clear the ID when the list is empty or the user logs out.

## Shell State

```text
loading -> success with selected MindSpace
loading -> empty with no selection
loading -> error with no displayed list
success -> success with a different selected MindSpace
```
