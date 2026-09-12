# T007 — Implement User Registration

## Goal

Implement user registration in the Auth module.

The endpoint must validate input, prevent duplicate accounts, hash the password, create the user in PostgreSQL through Prisma, and return a safe response without exposing the password hash.

## Phase

Phase 02 — Authentication & User

## Dependencies

- T001–T006 completed.
- `User` Prisma model exists.
- `PrismaService` is available.

## Endpoint

```text
POST /api/v1/auth/register
```

## Request Body

```json
{
  "email": "user@example.com",
  "password": "strong-password"
}
```

## DTO

Create a registration DTO using `class-validator`.

Required validation:

```text
email
- required
- valid email

password
- required
- string
- minimum length: 8
```

Use the existing global `ValidationPipe`.

Do not validate manually inside the controller.

## Flow

```text
HTTP Request
   ↓
Global ValidationPipe
   ↓
AuthController.register()
   ↓
AuthService.register()
   ↓
Check email uniqueness
   ↓
Hash password
   ↓
PrismaService.user.create()
   ↓
Return safe user response
```

## Duplicate Email Handling

Before creating the user, check whether the email already exists.

If it exists, throw an appropriate NestJS conflict exception.

Expected status:

```text
409 Conflict
```

Do not return Prisma/database internals to the client.

## Password Hashing

Use Argon2 for password hashing.

Install if not already installed:

```bash
npm install argon2
```

Store only the resulting hash in:

```text
User.passwordHash
```

Never store the raw password.

Do not create a separate password service or hashing abstraction in this ticket.

## User Creation

Create the user through the existing `PrismaService`.

Conceptually:

```text
email
passwordHash
```

Timestamps and UUID should continue to be handled by Prisma/database defaults defined in the schema.

## Response

Return only safe user information.

Example:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "createdAt": "..."
}
```

Do not return:

```text
password
passwordHash
```

No JWT/token is returned in this ticket.

## Controller Responsibility

`AuthController` should:

- receive the validated DTO
- call `AuthService.register()`
- return the service result

Do not put database or hashing logic in the controller.

## Service Responsibility

`AuthService.register()` should:

1. check whether the email already exists
2. throw `ConflictException` if it exists
3. hash the password
4. create the user
5. return safe user data

Keep the method direct and readable.

## UsersService

Do not move registration logic into `UsersService` just because a User record is created.

Registration is an authentication use case and belongs in `AuthService`.

Do not add extra cross-module abstractions for this ticket.

## Error Behavior

Expected errors:

```text
400 Bad Request
→ invalid request body

409 Conflict
→ email already registered
```

Unexpected database/runtime errors should continue through the application's normal NestJS exception handling.

Do not expose stack traces or database details.

## Implementation Principles

- Keep registration logic in one clear service method unless splitting becomes genuinely useful.
- Do not create repository interfaces.
- Do not create a hashing interface/provider.
- Do not create mapper classes.
- Do not create factories.
- Do not create a generic result wrapper.
- Do not introduce JWT yet.
- Do not implement login yet.
- Do not add email verification yet.
- Do not add roles/permissions yet.
- Reuse the existing Prisma integration.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Validation / Manual Test

Start the application:

```bash
npm run start:dev
```

### Successful Registration

Request:

```http
POST /api/v1/auth/register
Content-Type: application/json
```

```json
{
  "email": "haitham@example.com",
  "password": "password123"
}
```

Expected:

```text
201 Created
```

Response contains safe user information only.

Confirm in PostgreSQL:

- a new User row exists
- `passwordHash` contains a hash
- raw password is not stored

### Duplicate Registration

Send the same email again.

Expected:

```text
409 Conflict
```

### Invalid Email

```json
{
  "email": "not-an-email",
  "password": "password123"
}
```

Expected:

```text
400 Bad Request
```

### Short Password

```json
{
  "email": "new@example.com",
  "password": "123"
}
```

Expected:

```text
400 Bad Request
```

## Acceptance Criteria

- `POST /api/v1/auth/register` exists.
- Registration DTO validates email and password.
- Invalid requests return `400`.
- Duplicate email returns `409`.
- Password is hashed with Argon2.
- Raw password is never stored.
- User is created through `PrismaService`.
- Response does not expose `passwordHash`.
- Successful request returns `201`.
- No token/JWT logic exists yet.
- Application compiles with zero TypeScript errors.
- NestJS starts successfully.
- Registration works against the real PostgreSQL database.

## Out of Scope

- Login
- Logout
- JWT
- Refresh tokens
- Cookies
- Passport
- Authentication guards
- Email verification
- Password reset
- User profile
- Roles and permissions
- Tests beyond manual verification
