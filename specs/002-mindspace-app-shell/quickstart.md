# Quickstart: MindSpace App Shell

## Prerequisites

- Existing frontend authentication works.
- NestJS is running and the authenticated user can call `GET /api/v1/mindspaces`.
- The frontend API base URL points to NestJS.

## Manual Validation

1. Open `/{locale}/app` while logged out and confirm redirect to login.
2. Log in as a user with MindSpaces and confirm a loading state appears before the shell success state.
3. Confirm the selector lists the MindSpaces returned by NestJS and sends no `userId`.
4. Select a different MindSpace and confirm its name appears as the current context.
5. Refresh and confirm the valid selection remains current.
6. Store or simulate an invalid selected ID, reload, and confirm the first returned MindSpace becomes current.
7. Use an account with no MindSpaces and confirm the empty state appears without CRUD controls.
8. Simulate a failed request and confirm a safe translated error appears.
9. Log out and confirm auth and selected MindSpace state clear and the app redirects to login.
10. Repeat shell checks in English LTR and Arabic RTL.
11. Confirm selector and logout work by keyboard and the shell is usable at mobile and desktop widths.
12. Confirm any navigation placeholders are non-functional and no destination screens exist.

## Automated Validation

Run from `frontend/`:

```bash
npm run typecheck
npm run build
```

Use existing test tooling only if it exists at implementation time. Do not add a test framework for this feature.
