# T004 — Configure PostgreSQL and Prisma

## Goal

Connect the Priora MindCloud NestJS backend to PostgreSQL using Prisma.

## Phase

Phase 01 — NestJS Foundation

## Dependencies

- T001 — Initialize NestJS Backend
- T002 — Configure Environment and Application Bootstrap
- T003 — Configure Global Request Validation

## Scope

Add the minimum database foundation required before creating the application data model.

This ticket only establishes the PostgreSQL + Prisma connection.

## Requirements

### Install Prisma

Install the required Prisma packages:

```bash
npm install @prisma/client
npm install -D prisma
```

Initialize Prisma for PostgreSQL.

### Environment

Add the PostgreSQL connection string:

```env
DATABASE_URL=
```

Also add `DATABASE_URL` to `.env.example` without real credentials.

### Prisma Configuration

Configure Prisma to use PostgreSQL.

The Prisma setup should be minimal and follow the structure generated/recommended by the installed Prisma version.

### NestJS Integration

Create a small Prisma integration for NestJS so application services can later access the database through dependency injection.

Expected responsibility:

```text
PrismaService
    ↓
Prisma Client
    ↓
PostgreSQL
```

Do not create repositories or additional database abstraction layers.

### Connection Verification

Verify that Prisma can communicate with PostgreSQL using an appropriate Prisma command for the installed version.

No application entities need to be implemented in this ticket.

## Implementation Principles

- Use Prisma directly.
- Keep the database integration minimal.
- Do not create repository interfaces.
- Do not create generic repositories.
- Do not create base repository classes.
- Do not create a database manager or wrapper around Prisma.
- Do not create an interface for `PrismaService`.
- Do not create application entities yet.
- Do not add seed logic yet.
- Follow the anti-overengineering rules in `08-implementation-plan.md`.

## Acceptance Criteria

- Prisma packages are installed.
- Prisma is configured for PostgreSQL.
- `DATABASE_URL` is loaded from environment configuration.
- NestJS has a working Prisma service/provider.
- Prisma can successfully communicate with the configured PostgreSQL database.
- NestJS application still starts successfully.
- TypeScript compilation succeeds with zero errors.
- No application tables/entities have been introduced yet.

## Out of Scope

- User model
- MindSpace model
- Conversation model
- Message model
- Note model
- Task model
- Document model
- Database indexes
- Seed data
- Authentication
- Object Storage
- Qdrant
- Agent Service
- RAG Service
