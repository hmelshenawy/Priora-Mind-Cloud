# T001 — Initialize NestJS Backend

## Goal

Create the initial NestJS backend application for Priora MindCloud.

## Phase

Phase 01 — NestJS Foundation

## Scope

Initialize a clean NestJS application that will become the main backend service.

## Requirements

- Create the NestJS application.
- Use TypeScript.
- Use the standard NestJS project structure.
- Ensure the application can start successfully.
- Keep the initial structure minimal.
- Do not create feature modules yet.
- Do not create database configuration yet.
- Do not add authentication yet.
- Do not create abstractions that are not currently required.

Expected initial structure:

```text
backend/
└── src/
    ├── app.module.ts
    └── main.ts
```

Additional NestJS-generated files may remain if required by the framework/tooling.

## Implementation Principles

- Prefer the simplest working implementation.
- Do not create interfaces unless required.
- Do not create abstract/base classes.
- Do not introduce repository, factory, adapter, or provider patterns.
- Do not split simple logic into unnecessary helper functions.
- Do not install dependencies that are not required by this ticket.
- Follow the project-wide code quality and anti-overengineering rules defined in `08-implementation-plan.md`.

## Acceptance Criteria

- NestJS project installs successfully.
- Development server starts without errors.
- `GET /` returns a successful response.
- TypeScript compilation succeeds.
- Existing default tests pass, if retained.
- No business feature modules have been implemented.
- No unnecessary architecture has been introduced.

## Out of Scope

- PostgreSQL
- Prisma/ORM
- Authentication
- Validation configuration
- Logging
- Object Storage
- Qdrant
- Agent Service
- RAG Service
