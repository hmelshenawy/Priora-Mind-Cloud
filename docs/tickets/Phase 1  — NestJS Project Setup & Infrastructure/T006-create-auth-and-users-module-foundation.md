# T006 — Create Auth and Users Module Foundation

## Goal
Create the NestJS module structure for authentication and user functionality. This ticket establishes module boundaries only.

## Phase
Phase 02 — Authentication & User

## Dependencies
- T001–T005 completed.

## Scope

Create:

```text
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   └── auth.service.ts
└── users/
    ├── users.module.ts
    ├── users.controller.ts
    └── users.service.ts
```

Follow the existing project folder convention if it differs.

## Auth Module

Create:
- `AuthModule`
- `AuthController`
- `AuthService`

Later responsibilities include registration, login, token issuance, and authentication. Do not implement them in this ticket.

## Users Module

Create:
- `UsersModule`
- `UsersController`
- `UsersService`

Later responsibilities include user lookup and user-related operations. Do not implement CRUD/profile behavior yet.

## Module Registration

Register both modules in `AppModule`.

```text
AppModule
├── AuthModule
└── UsersModule
```

## Prisma

Reuse the existing `PrismaService`.

Do not create another Prisma client, repository, database wrapper, or abstraction.

If the existing Prisma module is global, nothing extra is needed. If it is not global, import it only into modules that actually need it.

No Prisma query is required in this ticket.

## API

No functional endpoints are required.

Do not create placeholder routes just to test the modules.

## Implementation Rules

- Keep the modules minimal.
- No interfaces without a current need.
- No repositories.
- No abstract/base services or controllers.
- No factories, adapters, managers, or wrappers.
- No Passport or JWT yet.
- No DTOs yet.
- No password hashing yet.
- Do not duplicate Prisma models as entity classes.
- Use normal NestJS dependency injection.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Validation

Run:

```bash
npm run start:dev
```

Confirm the application starts without dependency-injection or TypeScript errors.

## Acceptance Criteria

- `AuthModule` exists.
- `AuthController` exists.
- `AuthService` exists.
- `UsersModule` exists.
- `UsersController` exists.
- `UsersService` exists.
- Both modules are registered in `AppModule`.
- Existing Prisma integration remains unchanged.
- No authentication business logic is implemented prematurely.
- NestJS starts successfully.
- TypeScript reports no errors.

## Out of Scope

- Registration
- Login
- Logout
- Password hashing
- JWT access/refresh tokens
- Cookies
- Passport strategies
- Authentication guards
- Roles/authorization
- User profile
- Email verification
- Password reset
