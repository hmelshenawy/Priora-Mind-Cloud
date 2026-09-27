# Quickstart: Tasks Frontend

## Prerequisites

- Existing authentication, logout, locale routing, and MindSpace selection work.
- NestJS is available with the existing Tasks module and database connection.
- `NEXT_PUBLIC_NEST_API_BASE_URL` points to the running NestJS `/api/v1` base when the local default is not appropriate.
- The authenticated user has access to at least two MindSpaces.
- Test data includes one MindSpace with tasks covering optional description, known statuses/executors, and one MindSpace without tasks.
- Race/error scenarios use a sequence-aware HTTP interception proxy or browser request-interception tool that can hold and release one identified request and return a configured response for a later request. This is test tooling only and is not added to the application.

## Automated Validation

Run from `frontend/` after implementation:

```powershell
npm run typecheck
npm run build
```

Run from the repository root:

```powershell
git diff --check
```

No frontend test runner is currently configured. Do not add a testing framework solely for SPEC-006; complete the focused browser scenarios below. The backend is unchanged, so backend build is optional contract-confidence validation rather than a feature deliverable.

## Contract Validation

1. Confirm list sends an authenticated `GET /api/v1/tasks?mindSpaceId=<selected-id>` and no `userId`; validate exact request counts in a production build rather than React development Strict Mode.
2. Confirm returned tasks render in the exact response order without a browser-side sort.
3. Confirm create sends one authenticated JSON `POST /api/v1/tasks` containing the selected `mindSpaceId`, trimmed title, optional non-empty trimmed description, and exact `USER` or `AGENT` executor.
4. Confirm create never sends `userId`, status, ID, timestamps, or undeclared fields.
5. Confirm known status values include actual `PROGRESS`, not historical `IN_PROGRESS`.
6. Confirm choosing `AGENT` creates metadata only and makes no Agent request.
7. Confirm accepted creation starts one list revalidation without a page reload.

## Browser Validation

1. Open the protected app while logged out and confirm the existing locale-aware login behavior remains unchanged.
2. Log in, select a MindSpace containing tasks, and confirm the Tasks section renders only that MindSpace's records with title, executor, status, creation date, and descriptions when present.
3. Confirm a null or blank description occupies no unnecessary card content.
4. Confirm list loading, empty, success, and safe error states using controlled 400, 404, 429, network, and service failures; creation remains available in the empty state and no raw internal detail is exposed.
5. Confirm known executors and all four known statuses are translated, an unfamiliar safe value remains visible, and an invalid `createdAt` value uses safe fallback text without breaking the section.
6. Confirm creation controls open and dismiss with keyboard operation and begin with executor `USER`.
7. Submit an empty and a whitespace-only title; confirm field validation appears and zero create requests are sent.
8. Submit a valid title with a blank description; confirm description is omitted and the request succeeds.
9. Submit valid tasks for both `USER` and `AGENT`; confirm exact enum values are sent.
10. Attempt repeated submission while creation is delayed; confirm only one create request occurs and the submitting state is visible.
11. Confirm accepted creation closes and clears the form, displays the returned task immediately, and starts one background list revalidation without a page reload.
12. Return a task ID already present in the list; confirm it appears once and remains in its existing position.
13. Configure interception to hold the initial list response, allow create to complete, then release the older list and allow revalidation; confirm the invalidated initial response cannot erase accepted success and revalidation ultimately supplies backend order.
14. Configure interception to return a failure for the first list request after an accepted create; confirm accepted creation remains successful, the returned task stays visible, and a safe refresh error is shown.
15. Return malformed and wrong-MindSpace create records and confirm neither is inserted; then simulate 400, 404, 429, network, and service failures and confirm the draft is preserved, a safe translated error appears, and no raw internal detail is exposed.
16. Enter a draft and change MindSpace; confirm the old list, form, validation, submitting/success/revalidation state, and errors clear before the new list appears.
17. Use request interception to hold list, create, and revalidation responses, change MindSpace, and release the old non-authentication responses; confirm no old success, failure, task, refresh error, or form cleanup affects the new context.
18. Invalidate a Tasks request token and confirm its 401 clears auth and selected MindSpace state and opens locale login even when MindSpace selection changes before the response. Repeat while replacing stored auth with a different session before the old 401 arrives and confirm the old response does not clear the newer session.
19. Confirm existing logout behavior remains unchanged from the Tasks section.
20. Repeat core list/create flows in English LTR and Arabic RTL using keyboard-only interaction.
21. Test representative desktop and mobile widths, including the existing narrow breakpoint, and confirm long Arabic/English titles and multiline descriptions wrap without horizontal page breakage.
22. Confirm no edit, delete, status control, board, kanban, drag-and-drop, recurrence, reminders, scheduling, subtasks, priority, tags, filters, search, AI planning, automation, or pagination UI is present.

## Validation Results

- Baseline `npm run typecheck` (2026-09-27): PASS before implementation.
- Baseline `npm run build` (2026-09-27): PASS before implementation; all EN/AR routes generated.
- Planning artifact checks: PASS before implementation.
- Final `npm run typecheck` (2026-09-27): PASS.
- Final `npm run build` (2026-09-27): PASS; Next.js compiled, typechecked, and generated all EN/AR routes.
- `git diff --check` (2026-09-27): PASS; line-ending conversion warnings only.
- Contract/scope review (2026-09-27): PASS; no `userId`, status mutation, direct internal-service call, global Tasks state, generic API client, backend change, route, dependency, or out-of-scope task control was introduced.
- Focused implementation review (2026-09-27): PASS after tightening malformed-response rejection, form focus restoration, live submitting announcements, and unknown-metadata wrapping.
- Browser scenarios 1-22: pending; this CLI session has no live authenticated browser or sequence-aware request interception environment.
