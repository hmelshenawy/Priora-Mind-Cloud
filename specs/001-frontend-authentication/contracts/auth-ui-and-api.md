# Contract: Frontend Authentication UI and NestJS Auth API

## User-Facing Routes

### Login

- Path: `/{locale}/login`
- Purpose: Collect email and password from logged-out users.
- States: idle, loading, invalid credentials, network/server error.
- On success: redirect to `/{locale}/app`.

### Protected Landing Page

- Path: `/{locale}/app`
- Purpose: Minimal authenticated landing page.
- When logged out: redirect to `/{locale}/login`.
- Includes: logout control.

## NestJS Login Request

- Endpoint: existing NestJS `POST /auth/login` route, with any configured backend API prefix applied by environment/configuration.
- Request body:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

## NestJS Login Success Response

The frontend expects the current backend contract:

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  },
  "accessToken": "jwt_access_token"
}
```

## Error Handling Contract

- Invalid credentials: show a translated invalid-credentials message.
- Network/server failure: show a translated recoverable error message.
- Raw backend stack traces or sensitive response details are not shown to the user.

## Boundary Rules

- Frontend calls only NestJS.
- Frontend does not call Agent, RAG, Qdrant, PostgreSQL, Supabase, storage services, or other internal services.
- Frontend does not send `userId` manually for authentication.
