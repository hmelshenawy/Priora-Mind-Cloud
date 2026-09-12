# T010 — Implement JWT Strategy and Authentication Guard

## Goal

Protect backend routes using the JWT access token created in T009.

Implement:

```text
JwtStrategy
AuthGuard
```

The JWT strategy should validate the access token payload and attach the authenticated user identity to the request.

This ticket only handles authentication.

## Phase

Phase 02 — Authentication & User

## Dependencies

- T001–T009 completed.
- Login issues JWT access tokens.
- `JWT_SECRET` is configured.
- `JwtModule` is configured in `AuthModule`.

## Install

Add Passport JWT support:

```bash
npm install @nestjs/passport passport passport-jwt
npm install -D @types/passport-jwt
```

## Architecture

```text
HTTP Request
   ↓
Authorization: Bearer <token>
   ↓
AuthGuard
   ↓
JwtStrategy
   ↓
Verify JWT signature + expiration
   ↓
validate(payload)
   ↓
req.user
   ↓
Controller
```

## JWT Payload

T009 issues:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com"
}
```

The strategy should use those existing claims.

Do not add new JWT claims in this ticket.

## JwtStrategy

Create a JWT strategy inside the Auth module.

Suggested location:

```text
src/auth/
├── strategies/
│   └── jwt.strategy.ts
```

The strategy should:

1. extract the token from the Authorization Bearer header
2. use `JWT_SECRET`
3. reject expired tokens
4. validate the payload
5. return the authenticated request user

Expected request-user shape:

```ts
{
  id: payload.sub,
  email: payload.email
}
```

Passport will attach the returned value to:

```ts
req.user
```

## User Existence Check

For V1, validate that the user still exists in PostgreSQL before accepting the request.

Flow:

```text
valid JWT
  ↓
payload.sub
  ↓
Prisma user lookup
  ↓
user exists?
  ├── no → Unauthorized
  └── yes → return request user
```

Use the existing `PrismaService`.

Do not trust the token alone if the user record has been deleted.

## Authentication Guard

Create a small NestJS guard using Passport's JWT strategy.

Suggested location:

```text
src/auth/guards/
└── jwt-auth.guard.ts
```

Conceptually:

```ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Do not create custom token parsing logic inside the guard.

The strategy owns JWT validation.

## Passport Registration

Register Passport support in `AuthModule`.

Conceptually:

```text
AuthModule
├── PassportModule
├── JwtModule
├── JwtStrategy
├── AuthService
└── AuthController
```

Add `JwtStrategy` to module providers.

## Protected Test Route

Add one temporary/simple authenticated route to verify the flow.

Preferred endpoint:

```text
GET /api/v1/users/me
```

Protect it with:

```ts
@UseGuards(JwtAuthGuard)
```

The endpoint may simply return `req.user`.

Example response:

```json
{
  "id": "user-uuid",
  "email": "user@example.com"
}
```

Do not build full profile functionality yet.

## Public Routes

These must remain public:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
```

Do not apply the JWT guard globally in this ticket.

## Expected Behavior

### Valid Token

```text
GET /api/v1/users/me
Authorization: Bearer <valid token>
```

Expected:

```text
200 OK
```

### Missing Token

Expected:

```text
401 Unauthorized
```

### Invalid Token

Expected:

```text
401 Unauthorized
```

### Expired Token

Expected:

```text
401 Unauthorized
```

### Deleted User With Otherwise Valid Token

Expected:

```text
401 Unauthorized
```

## Request User Type

Keep it simple.

Do not create a large authentication context abstraction.

If a small TypeScript type improves readability, it may represent:

```ts
{
  id: string;
  email: string;
}
```

Do not create domain classes/interfaces unless they solve a current TypeScript need.

## Responsibilities

### JwtAuthGuard

```text
decide whether JWT authentication is required for the route
delegate authentication to Passport
```

### JwtStrategy

```text
extract token
verify token
validate payload
verify user exists
return authenticated user
```

### Controller

```text
receive req.user
execute endpoint behavior
```

## Implementation Principles

- Use NestJS Passport integration.
- Do not manually decode JWT in controllers.
- Do not manually read Authorization headers in controllers.
- Do not duplicate JWT verification logic.
- Reuse `JWT_SECRET`.
- Reuse `PrismaService`.
- Keep guard minimal.
- Keep strategy minimal.
- No roles guard.
- No permissions guard.
- No refresh token.
- No cookies.
- No global authentication guard yet.
- No authorization framework.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Manual Validation

### 1. Login

```http
POST /api/v1/auth/login
```

Get:

```text
accessToken
```

### 2. Call Protected Endpoint

```http
GET /api/v1/users/me
Authorization: Bearer <accessToken>
```

Expected:

```text
200 OK
```

and authenticated user data.

### 3. No Authorization Header

Expected:

```text
401 Unauthorized
```

### 4. Modify Token

Expected:

```text
401 Unauthorized
```

## Acceptance Criteria

- `@nestjs/passport`, `passport`, and `passport-jwt` are installed.
- `JwtStrategy` exists.
- JWT is extracted from Bearer authorization header.
- Strategy uses configured `JWT_SECRET`.
- Expired/invalid tokens are rejected.
- Strategy checks that the user still exists.
- Strategy returns authenticated user identity.
- Passport attaches authenticated identity to `req.user`.
- `JwtAuthGuard` exists.
- `GET /api/v1/users/me` is protected.
- Valid token returns `200`.
- Missing token returns `401`.
- Invalid token returns `401`.
- Register and login remain public.
- No role/permission logic is implemented.
- TypeScript compiles with zero errors.
- NestJS starts successfully.

## Out of Scope

- Refresh tokens
- Cookies
- Logout
- Roles
- Permissions
- Authorization guards
- Email verification
- Password reset
- Global guard
- Full profile implementation
