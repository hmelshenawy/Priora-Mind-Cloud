# Quickstart: Frontend Authentication

## Prerequisites

- NestJS backend is running and exposes the existing auth login endpoint.
- Frontend environment points to the NestJS API base URL.
- English and Arabic locales are available through `next-intl`.

## Manual Validation

1. Open `/{locale}/login` in English.
2. Confirm the email and password fields have visible labels and can be used by keyboard.
3. Submit empty fields and confirm translated validation appears.
4. Submit valid credentials and confirm the submit button shows loading and cannot be submitted twice.
5. Confirm successful login redirects to `/{locale}/app`.
6. Open `/{locale}/app` while logged out and confirm redirect to `/{locale}/login`.
7. Submit invalid credentials and confirm a clear translated error appears.
8. Stop or block the backend, submit credentials, and confirm a recoverable error appears.
9. Log in, choose logout, and confirm auth state is cleared and protected route access redirects to login.
10. Repeat the login page checks in Arabic and confirm RTL direction.
11. Check the login page on a mobile-sized viewport.

## Automated Test Focus

- Successful login stores frontend auth state and redirects to the protected landing page.
- Loading state disables duplicate submit.
- Invalid credentials and network errors show safe user-facing messages.
- Protected landing redirects when logged out.
- Logout clears auth state and returns to login.
- English and Arabic labels are present and accessible.
