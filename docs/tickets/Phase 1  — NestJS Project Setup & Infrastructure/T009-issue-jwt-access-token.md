# T009 — Issue JWT Access Token on Login

## Goal

Add JWT access-token issuance to the existing login flow.

After valid credentials are confirmed, the backend should create and return a signed access token containing the minimum user identity needed by the application.

This ticket does not implement refresh tokens, cookies, Passport strategies, or route guards yet.

## Phase

Phase 02 — Authentication & User

## Dependencies

- T001–T008 completed.
- User registration works.
- User login works.
- `PrismaService` is available.
- `ConfigModule` is already global.

## Install

Add NestJS JWT support:

```bash
npm install @nestjs/jwt
```

Do not install Passport in this ticket.

## Environment Variables

Add:

```env
JWT_SECRET=
JWT_EXPIRES_IN=15m
```

Also add the keys to `.env.example`.

Use a strong secret locally and never commit the real secret.

## Auth Module

Register `JwtModule` inside `AuthModule`.

Configuration should come from environment/config.

Conceptually:

```text
AuthModule
├── AuthController
├── AuthService
└── JwtModule
```

Do not create a separate token module.

## JWT Payload

Keep the payload minimal.

Use:

```text
sub → user.id
email → user.email
```

Example conceptual payload:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com"
}
```

Do not place sensitive data in the token.

Do not include:

```text
password
passwordHash
```

Do not add roles/permissions because they are not part of the current V1 user model.

## Login Flow

Existing login flow becomes:

```text
POST /api/v1/auth/login
        ↓
validate DTO
        ↓
find user
        ↓
verify Argon2 password
        ↓
sign JWT access token
        ↓
return user + accessToken
```

## AuthService

Inject NestJS `JwtService` into `AuthService`.

After credentials are validated:

```text
create payload
↓
sign access token
↓
return token
```

Keep the token-generation logic direct.

A separate token service/helper is not required for one current use case.

## Successful Response

Recommended response:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "accessToken": "jwt-token"
}
```

Never return `passwordHash`.

## Registration

Registration behavior from T007 should remain unchanged.

Do not automatically issue a token during registration in this ticket.

Only login issues the access token.

## Configuration Failure

The application should not silently run with an undefined JWT secret.

Read the secret through `ConfigService`.

Fail clearly if `JWT_SECRET` is missing.

Do not hardcode the JWT secret in source code.

## Token Expiration

Use configuration:

```env
JWT_EXPIRES_IN=15m
```

A short-lived access token is sufficient for this ticket.

No refresh mechanism is added yet.

## Manual Validation

### Successful Login

```http
POST /api/v1/auth/login
```

```json
{
  "email": "haitham@example.com",
  "password": "password123"
}
```

Expected:

```text
200 OK
```

Response includes:

```text
user
accessToken
```

### Invalid Login

Wrong email or password should still return:

```text
401 Unauthorized
```

No token should be created.

## JWT Verification

Take the returned access token and verify that it contains the expected claims:

```text
sub
email
iat
exp
```

The token must be signed using the configured secret.

## Implementation Principles

- Use NestJS `JwtModule` and `JwtService`.
- Keep JWT logic inside the existing Auth module.
- No Passport yet.
- No JWT strategy yet.
- No auth guard yet.
- No refresh token yet.
- No cookies yet.
- No token database table.
- No token repository.
- No token abstraction/provider/factory.
- No roles/permissions yet.
- Do not add unnecessary claims.
- Reuse the existing configuration system.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Acceptance Criteria

- `@nestjs/jwt` is installed.
- `JWT_SECRET` exists in environment configuration.
- `JWT_EXPIRES_IN` exists in environment configuration.
- `JwtModule` is configured in `AuthModule`.
- `JwtService` is injected into `AuthService`.
- Successful login creates a signed JWT access token.
- JWT payload contains `sub` and `email`.
- JWT includes expiration.
- Login response returns `accessToken`.
- Login response never exposes `passwordHash`.
- Invalid credentials still return `401`.
- Registration behavior remains unchanged.
- No refresh-token logic exists.
- No Passport/guard logic exists.
- TypeScript compiles with zero errors.
- NestJS starts successfully.

## Out of Scope

- Refresh tokens
- HttpOnly cookies
- Logout
- Passport
- JWT strategy
- Authentication guard
- Protected routes
- Roles and permissions
- Email verification
- Password reset
- Token revocation
- Token persistence
