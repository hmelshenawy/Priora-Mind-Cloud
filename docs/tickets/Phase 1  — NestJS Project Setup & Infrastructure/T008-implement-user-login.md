# T008 — Implement User Login

## Goal

Implement user login in the Auth module.

Validate credentials, find the user by email, verify the submitted password against the stored Argon2 hash, and return safe user information.

No JWT/token issuance in this ticket.

## Phase

Phase 02 — Authentication & User

## Dependencies

- T001–T007 completed.
- User registration works.
- Passwords are stored as Argon2 hashes.
- `PrismaService` is available.

## Endpoint

```text
POST /api/v1/auth/login
```

## Request Body

```json
{
  "email": "user@example.com",
  "password": "strong-password"
}
```

## DTO

Create a login DTO using `class-validator`.

Validation:

```text
email
- required
- valid email

password
- required
- string
```

Use the existing global `ValidationPipe`.

Do not reuse registration-only validation such as minimum password length if it is not needed for login.

## Flow

```text
HTTP Request
   ↓
Global ValidationPipe
   ↓
AuthController.login()
   ↓
AuthService.login()
   ↓
Find user by email
   ↓
User exists?
   ├── No → 401 Unauthorized
   └── Yes
        ↓
argon2.verify(storedHash, submittedPassword)
        ↓
Password valid?
   ├── No → 401 Unauthorized
   └── Yes
        ↓
Return safe user data
```

## User Lookup

Use the existing `PrismaService`.

Conceptually:

```ts
prisma.user.findUnique({
  where: { email }
})
```

## Password Verification

Use:

```ts
argon2.verify(user.passwordHash, dto.password)
```

Do not hash the submitted password again and compare hash strings.

## Invalid Credentials

For both:

```text
unknown email
wrong password
```

return:

```text
401 Unauthorized
```

Use the same public message for both, for example:

```text
Invalid email or password
```

Do not reveal whether a specific account exists.

## Successful Response

Return safe user information only.

Example:

```json
{
  "id": "uuid",
  "email": "user@example.com"
}
```

`createdAt` may also be returned if desired.

Never return:

```text
password
passwordHash
```

No JWT/token is returned in this ticket.

## Controller Responsibility

`AuthController.login()` should:

- receive the validated DTO
- call `AuthService.login()`
- return the service result

No Prisma or Argon2 logic in the controller.

## Service Responsibility

`AuthService.login()` should:

1. find the user by email
2. reject missing user
3. verify password with Argon2
4. reject invalid password
5. return safe user data

The Auth service should now remain simple:

```text
register()
login()
```

## Error Behavior

```text
400 Bad Request
→ invalid request body

401 Unauthorized
→ unknown email OR incorrect password
```

Do not expose internal database errors, hashes, or stack traces.

## Implementation Principles

- Keep login logic direct.
- Reuse `PrismaService`.
- Reuse Argon2.
- No repository layer.
- No password abstraction.
- No mapper classes.
- No generic result wrapper.
- No Passport yet.
- No JWT yet.
- No refresh token yet.
- No cookies yet.
- No roles/permissions yet.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Manual Validation

### Correct Credentials

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

### Wrong Password

Expected:

```text
401 Unauthorized
```

### Unknown Email

Expected:

```text
401 Unauthorized
```

Use the same public error message as wrong password.

### Invalid Email

Expected:

```text
400 Bad Request
```

## Acceptance Criteria

- `POST /api/v1/auth/login` exists.
- Login DTO validates input.
- User is found through `PrismaService`.
- Password is verified with `argon2.verify()`.
- Correct credentials return `200`.
- Unknown email returns `401`.
- Wrong password returns `401`.
- Both invalid credential cases use the same public message.
- `passwordHash` is never returned.
- No JWT/token logic exists yet.
- Existing registration still works.
- TypeScript compiles with zero errors.
- NestJS starts successfully.
- Login works against the real PostgreSQL database.

## Out of Scope

- JWT access token
- Refresh token
- Cookies
- Logout
- Passport
- JWT strategy
- Authentication guard
- Protected routes
- Email verification
- Password reset
- Roles and permissions
- User profile
