# Implementation Plan: Frontend Authentication

**Branch**: `main` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-frontend-authentication/spec.md`

## Summary

Implement the minimal frontend authentication flow for Priora MindCloud: localized login page, email/password form, NestJS login call, session-scoped authenticated state, protected route guard, logout by clearing frontend auth state, and a simple protected landing page. The plan intentionally avoids auth frameworks, global state libraries, permission systems, refresh handling, and product screens outside authentication.

## Technical Context

**Language/Version**: TypeScript with Next.js 16 App Router

**Primary Dependencies**: React, Next.js, next-intl, existing project tooling only

**Storage**: Simplest browser-side mechanism compatible with the existing NestJS authentication contract

**Testing**: Use existing frontend test tooling only. If no frontend test tooling exists, do not introduce a new test framework in this feature.

**Target Platform**: Web browsers on desktop and mobile

**Project Type**: Next.js frontend

**Performance Goals**: Login form remains responsive during submission; no advanced performance work planned

**Constraints**: Frontend calls only NestJS; English LTR and Arabic RTL; no auth framework; no global state library; no registration, reset, social login, MFA, roles, permissions, profile, or product screens

**Scale/Scope**: One login flow, one protected landing page, one protected route pattern, English and Arabic messages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Simplicity: PASS. Uses direct fetch, simple browser-side auth state, local component state, and one lightweight route guard. No speculative abstractions.
- Readability: PASS. Planned files have narrow responsibilities and are expected to remain well below 300 lines.
- API boundary: PASS. The only backend call is to the NestJS auth login endpoint; no Agent, RAG, Qdrant, PostgreSQL, Supabase, or storage access.
- Backend authority: PASS. Frontend follows the NestJS login contract and does not send `userId` manually or duplicate backend auth rules.
- User states: PASS. Login covers idle, loading, success redirect, invalid credentials, and network/server error states.
- Accessibility and responsive design: PASS. Login uses labels, keyboard submission, clear button state, responsive layout, and locale direction.
- Dependencies and state: PASS. No new runtime dependency or global state library is planned.
- Testing: PASS. Tests focus on login behavior, errors, protected route behavior, logout, and localized accessibility basics.

Post-design re-check: PASS. Phase 0 and Phase 1 artifacts keep the same minimal approach and add no unjustified complexity.

## Project Structure

### Documentation (this feature)

```text
specs/001-frontend-authentication/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-ui-and-api.md
└── tasks.md             # Created by /speckit.tasks, not this plan
```

### Source Code (repository root)

```text
frontend/
├── app/
│   └── [locale]/
│       ├── login/
│       │   └── page.tsx
│       └── app/
│           └── page.tsx
├── components/
│   └── auth-gate.tsx
├── lib/
│   ├── api/
│   │   └── auth.ts
│   └── auth-state.ts
├── messages/
│   ├── en.json
│   └── ar.json
└── tests/
    └── auth.test.tsx
```

**Structure Decision**: Keep auth code shallow. API calling code lives in `frontend/lib/api/auth.ts`; simple auth-state helpers live in `frontend/lib/auth-state.ts`; UI remains in the login page and `auth-gate.tsx`. No feature folder is needed unless implementation reveals real duplication.

## Minimal Implementation Decisions

- Login route: `/{locale}/login` renders the email/password form.
- Protected landing route: `/{locale}/app` is the post-login destination and proves protected routing.
- API call: `frontend/lib/api/auth.ts` exports one `login` function that posts email/password to the NestJS login endpoint and returns the backend response shape.
- Auth state: store the access token using the simplest browser-side mechanism compatible with the existing NestJS authentication contract. Do not introduce refresh-token handling, session infrastructure, auth frameworks, or additional state-management architecture in this feature. Keep authentication state simple and easy to replace later if the backend contract changes.
- Protected routes: `auth-gate.tsx` checks frontend authenticated state on the client and redirects unauthenticated users to `/{locale}/login`.
- Logout: clear frontend auth state and redirect to login. This feature does not require a backend logout endpoint.
- i18n/RTL: use `next-intl` messages for labels, validation, loading, errors, and logout text. Locale layout owns `dir="ltr"` for English and `dir="rtl"` for Arabic.
- Loading/errors: login page keeps local form state only. Disable submit while loading. Show generic invalid-credentials and network/server messages without raw backend details.
- Tests: use existing frontend test tooling only to cover valid login redirect, duplicate-submit prevention, invalid credentials error, network error, protected redirect, logout clearing state, and English/Arabic accessible labels. If no frontend test tooling exists, keep validation to existing project capabilities and do not add a new test framework.

## Complexity Tracking

No constitution violations. No complexity exceptions required.
