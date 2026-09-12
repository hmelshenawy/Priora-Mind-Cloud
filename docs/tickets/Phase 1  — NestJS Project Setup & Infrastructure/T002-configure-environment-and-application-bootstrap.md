# T002 — Configure Environment and Application Bootstrap

## Goal

Configure the minimal application-level bootstrap settings required by the Priora MindCloud NestJS backend.

## Phase

Phase 01 — NestJS Foundation

## Dependencies

- T001 — Initialize NestJS Backend

## Scope

Add environment configuration and the basic global HTTP application setup.

## Requirements

### Environment Configuration

- Install and configure `@nestjs/config`.
- Load configuration through `ConfigModule`.
- Make configuration globally available.
- Add a `.env.example` file containing only variables required at this stage.
- Do not commit real secrets.

Initial environment variables:

```env
PORT=3000
NODE_ENV=development
```

### Application Bootstrap

Configure `main.ts` with:

- Global API prefix: `/api/v1`
- Application port loaded from configuration.
- Default port fallback: `3000`.

Expected route after this ticket:

```text
GET /api/v1/
```

## Implementation Principles

- Keep `main.ts` simple.
- Do not create a custom configuration abstraction unless it is currently required.
- Do not create interfaces or classes for environment variables.
- Do not create multiple configuration files for two simple values.
- Do not add validation libraries for environment variables in this ticket.
- Do not add infrastructure unrelated to application bootstrap.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Acceptance Criteria

- Application starts successfully.
- `ConfigModule` is configured.
- `PORT` can be read from the environment.
- Application falls back to port `3000` when `PORT` is not provided.
- Global API prefix is `/api/v1`.
- `GET /api/v1/` returns the existing successful response.
- TypeScript compilation succeeds with zero errors.

## Out of Scope

- Request DTO validation
- Global `ValidationPipe`
- PostgreSQL
- ORM
- Authentication
- Logging infrastructure
- Exception filters
- Object Storage
- Qdrant
- Agent Service
- RAG Service
