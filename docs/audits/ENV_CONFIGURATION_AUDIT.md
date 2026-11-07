# Environment configuration audit

Date: 2026-11-07. Scope: current working tree, including pre-existing local changes. Reviewed all 14 existing environment/template files under Backend, Agent, RAG and Frontend, both Compose files, Dockerfiles/ignore files, application environment readers, evaluation/test settings and relevant installed SDK readers. Added the canonical RAG template, bringing the environment/template inventory to 15. No secret values are included here.

## Service authentication

Presence and equality were checked in memory; values were neither printed nor copied into this report.

| Variable | Required services | Local `.env` | `.env.docker` |
|---|---|---|---|
| `AGENT_SECRET_KEY` | Backend sender, Agent verifier | Present, nonempty and matching | Present, nonempty and matching |
| `RAG_SECRET_KEY` | Backend ingestion sender, Agent search/embed sender, RAG verifier | **Missing in Backend**; Agent/RAG present and matching | **Missing in Backend**; Agent/RAG present and matching |

Backend ingestion now calls `getOrThrow("RAG_SECRET_KEY")` (`backend/src/documents/rag.service.ts:12-20`), so the missing Backend setting blocks ingestion unless supplied externally. Agent authentication is wired through `backend/src/agent/agent.service.ts:13-15` and `agent-service/src/agentcore/utils/service_verfication.py:20`; RAG verification reads its key in `rag-service/src/ragcore/utils/service_verfication.py:25`. The protected routes use these dependencies. Frontend requires neither service key and must not expose either through `NEXT_PUBLIC_*`.

**Required operator action:** populate Backend's local and Docker `RAG_SECRET_KEY` from the corresponding environment's existing RAG service secret. Actual environment files were intentionally left unchanged. Matching nonempty values establishes configuration consistency, not entropy, validity, or successful live authentication.

## Findings by service

| Service | Code-consumed configuration | Findings and template correction |
|---|---|---|
| Backend | `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AGENT_SERVICE_URL`, `AGENT_SECRET_KEY`, `AGENT_TIMEOUT_MS`, `RAG_URL`, `RAG_SECRET_KEY`, `REDIS_HOST`, `REDIS_PORT` | Example lacked Supabase URL/server key and RAG service key; added safe placeholders. Corrected Agent URL to include `/chat`. Retained `NODE_ENV` as a framework/runtime convention, not an explicit application reader. |
| Agent | `TIMEZONE`, `OLLAMA_MODEL_NAME`, `OLLAMA_API_KEY`, `RAG_SERVICE_URL`, `BACKEND_SERVICE_URL`, `RAG_SECRET_KEY`, `AGENT_SECRET_KEY`; SDK reads `OLLAMA_HOST` and LangSmith settings | Existing example mixed endpoint conventions. Corrected RAG origin and Backend `/api/v1` prefix, made defaults local, documented Docker alternatives, replaced credential fields with placeholders. Added evaluation-variable documentation. |
| RAG | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, `EMBEDDING_MODEL`, `EMBEDDING_BATCH_SIZE`, `EMBEDDING_DIM`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`, `ENV`, `RAG_SECRET_KEY` | Required names exist in local/Docker files. Only template was misspelled `.env.exmaple`; added `.env.example` with all names and evaluation settings. Left legacy file untouched. Actual embedding dimension is consistent with the 1,024-dimensional memory contract. Model/collection placeholders deliberately require selecting the existing compatible index. |
| Frontend | `NEST_INTERNAL_API_BASE_URL`; optional test-only `PLAYWRIGHT_BASE_URL` | Actual `.env` and `.env.docker` use obsolete `NEXT_PUBLIC_NEST_API_BASE_URL`, which has no reader in current application code; neither defines the current server variable. Local code falls back to localhost. Canonical example already used the right name; clarified build/runtime behavior and added optional test setting. |

Reader evidence: `backend/src/main.ts:10`, `auth/auth.module.ts:15-17`, `prisma/prisma.service.ts:9`, `backend/prisma7.config.ts:12`, `documents/storage.service.ts:12`, `app.module.ts:31-32`; `agent-service/src/agentcore/config.py:7-12`; `rag-service/src/ragcore/config.py:8-18`; `frontend/next.config.ts:10`, `frontend/app/api/chat-stream/[id]/route.ts:4`, `frontend/playwright.config.ts:6-7`.

Unused/inconsistent settings:

- `SUPABASE_PASSWORD` exists in Backend/RAG actual environment files, but no application reader uses it. Removed it from the Backend template; database access uses `DATABASE_URL`, and storage uses the server key. Actual files remain untouched.
- `RAG_URL` (Backend) and `RAG_SERVICE_URL` (Agent) are intentionally different names with actual readers; both must be origins without `/v1`, because callers append versioned routes. Existing actual local/Docker URL paths match this contract. Agent's code fallback still includes an incompatible `/api/v1` path (`config.py:10`); explicit correct configuration avoids it. Code correction is outside scope.
- `LANGSMITH_AGENT_ID` and `LANGSMITH_AGENT_ENVIRONMENT` are **not unused**: the installed LangSmith SDK reads the pair (`langsmith/address.py:180-210`). `OLLAMA_HOST` is also SDK-consumed (`ollama/_client.py:113`). The example documents optional paired identity or project routing. Actual Agent local/Docker files enable tracing without input/output hiding; the example now disables tracing and enables both hiding flags by default. This is configuration hygiene, not a guarantee that every logging sink is sanitized.
- Agent `.env.eval` contains required `EVAL_JWT` and `EVAL_MINDSPACE_ID`; `EVAL_MODEL` and `EVAL_OLLAMA_URL` are optional with code defaults. RAG `.env.eval` supplies its four evaluation settings. These names are now documented as commented optional entries in service examples, to copy into `.env.eval` deliberately. RAG evaluation defaults to a different port from the container listener and **does not send the newly required service-key header** (`ragcore/evals/runner.py:23,30-39,64-73`); environment additions alone cannot repair that runner.

## Docker and production

- Both development and production Compose load Backend, Agent and RAG `.env.docker` files. There is no separate production environment file in the inspected tree. Deployed process environments and secret-manager overrides were not inspected.
- Frontend `.env.docker` is not loaded by either Compose file. Both explicitly supply `NEST_INTERNAL_API_BASE_URL` as a build argument and runtime variable; the Dockerfile propagates it before `next build`. Thus Docker avoids the stale Frontend env-name problem. Build/runtime origins should remain consistent.
- Production Compose overrides Redis host/port and supplies Redis. Development Compose supplies no Redis service; Backend's Docker file does not use the Compose Redis service name. Development therefore needs a separately reachable Redis instance; connectivity was not tested.
- Python services load `.env` through dotenv for local use; Compose injects Docker settings. `.env.docker` is not automatically loaded by dotenv or Nest outside Compose. All four Docker ignore files exclude actual `.env*` files while allowing `.env.example`.

## Changes and validation

Updated `backend/.env.example`, `agent-service/.env.example`, `frontend/.env.example`; created `rag-service/.env.example`. Secrets use obvious replacement placeholders, not real values. Optional evaluation/tracing identity settings are comments, avoiding accidental activation. No new application variables without readers were introduced as required settings.

Validation: static variable-name/reader comparison, service-key presence/equality checks, URL-path contract checks, template parsing and placeholder review. File-hash comparison verifies actual environment files, application code and deployment configuration remain unchanged by this task. No services were started, credentials exercised, packages installed, commits created or changes pushed. Existing unrelated working-tree edits were preserved. Postman setup/evaluation was unnecessary for this configuration-only audit.
