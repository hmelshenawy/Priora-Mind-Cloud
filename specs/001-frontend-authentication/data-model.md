# Data Model: Frontend Authentication

This feature has no persisted frontend domain model. The backend remains the source of truth for user identity and authentication.

## Login Request

- `email`: required string entered by the user.
- `password`: required string entered by the user.

Validation rules:
- Email and password must be present before submission.
- Email may be trimmed before submission.

## Login Response

Expected from the existing NestJS login contract:

- `accessToken`: token used by the frontend according to the backend contract.
- `user.id`: backend user identifier; stored only as returned user data, not sent manually for auth decisions.
- `user.email`: user email for display if needed.

## Frontend Auth State

- `accessToken`: copied from successful login response.
- `user`: minimal user object returned by login.

Storage rule:
- Store using the simplest browser-side mechanism compatible with the existing NestJS authentication contract.
- Do not introduce refresh-token handling, session infrastructure, auth frameworks, or additional state-management architecture in this feature.
- Keep authentication state simple and easy to replace later if the backend contract changes.
- Clear on logout.

State transitions:

```text
logged-out -> logging-in -> authenticated
logged-out -> logging-in -> login-error
authenticated -> logged-out
```

## Login UI State

- `email`: current email field value.
- `password`: current password field value.
- `isLoading`: true while the login request is active.
- `errorMessage`: translated user-facing error for validation, invalid credentials, or network/server failure.
