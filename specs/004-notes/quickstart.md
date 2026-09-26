# Quickstart: Notes

## Prerequisites

- Existing authentication, logout, and MindSpace selection work.
- NestJS is available with the existing Notes module and database connection.
- The authenticated user has access to at least one MindSpace.
- For full coverage, test data includes a MindSpace with notes, a MindSpace without notes, and a note that can be made unavailable during selection.

## Manual Validation

1. Open the protected app while logged out and confirm the existing locale-aware login redirect still occurs.
2. Log in, select a MindSpace, and confirm Notes loads only that MindSpace's notes with `mindSpaceId` and shows titles in backend order.
3. Confirm list loading, empty, success, and safe error states using appropriate test data or controlled responses.
4. Select an existing note and confirm a get-one request loads its authoritative title and full plain-text content.
5. Select a different note while the first get-one request is delayed and confirm the first result cannot overwrite the newer selection.
6. Make a selected note unavailable and confirm no stale content remains while the translated unavailable state appears.
7. Submit with an empty or whitespace-only title and valid content; confirm no create request is sent and title validation appears.
8. Submit with a valid title and empty or whitespace-only content; confirm no create request is sent and content validation appears.
9. Submit a valid title and content and confirm duplicate submission is disabled while creation is active.
10. Confirm successful creation prepends the returned note, opens its persisted title/content immediately, clears the form, and performs no page reload or redundant get-one request.
11. Simulate creation failure and confirm title/content remain entered while a safe translated error appears.
12. Open a note and enter a creation draft, then change MindSpace; confirm the old list, selection, displayed content, inputs, validation, unavailable state, and errors clear before the new list loads.
13. Change MindSpace while list, get-one, and create requests are delayed; confirm late results never alter the new MindSpace context.
14. Simulate unauthorized list, get-one, and create responses; confirm auth and selected MindSpace state clear and locale login redirect occurs.
15. Confirm existing logout behavior remains unchanged.
16. Repeat the complete flow in English LTR and Arabic RTL with keyboard-only operation at representative desktop and mobile widths.
17. Confirm long titles, long content, and embedded line breaks remain readable without horizontal page breakage.
18. Confirm no edit, delete, rich text, Markdown, tags, search, sorting/filtering, attachments, sharing, history, Agent-specific UI, or pagination controls are present.

## Automated Validation

Run from `frontend/`:

```bash
npm run typecheck
npm run build
```

Use existing frontend test tooling only if it exists at implementation time. Do not add a test framework for this feature.

## Validation Results (2026-09-26)

- `npm run typecheck`: PASS.
- `npm run build`: PASS; Next.js compiled, typechecked, and generated all EN/AR routes.
- `git diff --check`: PASS (line-ending conversion warnings only).
- Manual scenarios 1-18: documented above and pending execution in a browser with a live authenticated NestJS instance and suitable test data; that environment was not available in this CLI session.
- Scope review: PASS; no dependency, route, provider, global state, proxy, backend change, or out-of-scope Notes control was added.
