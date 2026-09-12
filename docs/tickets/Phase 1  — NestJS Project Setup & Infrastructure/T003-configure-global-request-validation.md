# T003 — Configure Global Request Validation

## Goal

Configure the NestJS backend to validate incoming request DTOs globally.

## Phase

Phase 01 — NestJS Foundation

## Dependencies

- T001 — Initialize NestJS Backend
- T002 — Configure Environment and Application Bootstrap

## Scope

Add the minimal validation setup required before implementing feature modules and API DTOs.

## Requirements

### Dependencies

Install:

```bash
npm install class-validator class-transformer
```

### Global ValidationPipe

Configure a global `ValidationPipe` in `main.ts`.

Use:

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
})
```

### Expected Behavior

```text
Valid request
    ↓
Controller receives validated/transformed DTO

Invalid request
    ↓
NestJS returns 400 Bad Request

Unknown request fields
    ↓
Request rejected with 400 Bad Request
```

## Implementation Principles

- Keep validation configuration in `main.ts`.
- Do not create a custom validation pipe.
- Do not create a validation abstraction or wrapper.
- Do not create base DTO classes.
- Do not create example feature modules only to test validation.
- Do not add Zod or another validation library.
- Use NestJS standard validation with `class-validator` and `class-transformer`.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Acceptance Criteria

- `class-validator` is installed.
- `class-transformer` is installed.
- Global `ValidationPipe` is registered.
- `whitelist` is enabled.
- `forbidNonWhitelisted` is enabled.
- `transform` is enabled.
- Application starts successfully.
- TypeScript compilation succeeds with zero errors.
- Existing `GET /api/v1` route still works.

## Out of Scope

- Feature DTOs
- Custom validators
- Custom exception formatting
- Exception filters
- PostgreSQL
- ORM
- Authentication
- Logging infrastructure
- Object Storage
- Qdrant
- Agent Service
- RAG Service
