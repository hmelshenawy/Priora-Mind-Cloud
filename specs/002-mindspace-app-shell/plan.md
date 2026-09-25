# Implementation Plan: MindSpace App Shell

**Branch**: `main` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-mindspace-app-shell/spec.md`

## Summary

Replace the simple protected landing content with a minimal app shell that fetches the authenticated user's MindSpaces from NestJS, keeps one selected MindSpace in local component state, and preserves its ID with the same browser storage approach already used by authentication. Reuse `AuthGate`, `getAuthState`, the existing API base URL, logout behavior, locale layout, and message files. Add no dependencies, providers, global state, destination screens, or backend changes.

## Technical Context

**Language/Version**: TypeScript with Next.js 16 App Router

**Primary Dependencies**: Existing React, Next.js, and next-intl dependencies only

**Storage**: Existing browser `sessionStorage` approach, storing only the selected MindSpace ID under a separate key

**Testing**: Existing frontend test tooling only; none currently exists, so do not add a test framework

**Target Platform**: Web browsers on desktop and mobile

**Project Type**: Existing Next.js frontend

**Performance Goals**: One MindSpace request when the protected shell mounts; immediate local selection updates without additional requests

**Constraints**: NestJS-only API access; bearer token from existing auth state; English LTR and Arabic RTL; no CRUD, destination screens, global state, new auth, new dependencies, or speculative abstractions

**Scale/Scope**: One protected shell, one MindSpace selector, one persisted selected ID, and loading/empty/success/error states

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Simplicity: PASS. One direct MindSpace API function, one selection helper, and one focused shell component are sufficient.
- Readability: PASS. API, selection persistence, and shell presentation have clear responsibilities; planned files remain below 300 lines.
- API boundary: PASS. The frontend calls only authenticated `GET /api/v1/mindspaces` on NestJS.
- Backend authority: PASS. NestJS owns authentication, ownership, and returned MindSpaces; the frontend sends no `userId`.
- User states: PASS. The shell explicitly handles loading, empty, success, and safe error states.
- Accessibility and responsive design: PASS. The selector and logout are labeled and keyboard accessible; the shell remains usable on mobile and desktop with locale direction inherited from the existing layout.
- Dependencies and state: PASS. No dependency or global state library is added; MindSpaces remain local component state.
- Testing: PASS. Validation uses current typecheck/build and manual behavior checks because no frontend test tooling exists.

Post-design re-check: PASS. The Phase 0 and Phase 1 artifacts retain direct data flow, local state, existing storage, and no additional architecture.

## Project Structure

### Documentation (this feature)

```text
specs/002-mindspace-app-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mindspaces-and-shell.md
└── tasks.md             # Created by /speckit.tasks, not this plan
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── globals.css
│   └── [locale]/
│       └── app/
│           └── page.tsx
├── components/
│   ├── auth-gate.tsx             # Reused unchanged unless integration requires a minimal fix
│   └── app-shell.tsx             # Shell UI and local MindSpace request/selection state
├── lib/
│   ├── api/
│   │   └── mindspaces.ts         # Direct authenticated NestJS request and actual response types
│   ├── auth-state.ts             # Reused for access token and logout
│   └── mindspace-selection.ts    # Read/write/clear selected MindSpace ID
└── messages/
    ├── en.json
    └── ar.json
```

**Structure Decision**: Keep the route page small by composing the existing `AuthGate` with one `AppShell`. Add only an API file and a selection persistence file because they have distinct responsibilities and keep storage/request details out of the UI. Do not create hooks, providers, feature layers, generic clients, or navigation destinations.

## Data Flow

1. `frontend/app/[locale]/app/page.tsx` remains protected by `AuthGate` and renders `AppShell`.
2. `AppShell` reads the access token from `getAuthState()` and calls `getMindSpaces(accessToken)` once when mounted.
3. `getMindSpaces` sends `GET /api/v1/mindspaces` with the bearer token to the existing NestJS API base URL.
4. NestJS derives the user from the token, enforces ownership, and returns its existing MindSpaces response contract. Implementation must match the actual backend shape discovered during inspection and must not add a new envelope or normalization adapter.
5. `AppShell` keeps the returned array and current selected ID in local state; no server state cache or global store is introduced.
6. The shell renders loading, empty, error, or success UI and displays the selected MindSpace name.

## MindSpace Selection And Persistence

- Store only the selected MindSpace ID in `sessionStorage`, matching the existing auth-state storage lifetime and avoiding a second persistence model.
- After loading, retain the stored ID only if it exists in the returned list.
- If the stored ID is stale or absent and the list is non-empty, select and persist the first returned MindSpace.
- If the list is empty, clear the stored selection and render the empty state.
- Changing the selector updates local state and the stored ID immediately, without a backend write.

## Loading, Empty, Success, And Error Handling

- Loading: show translated shell loading text while the request is active.
- Empty: render a translated message with no create/edit controls.
- Success: render the selector and current MindSpace name.
- Error: render a translated safe network/API error; do not expose backend internals.
- Unauthorized response: clear existing auth state and return to the locale login route, preserving current authentication behavior.

## Logout Integration

- Keep logout in the shell and reuse `clearAuthState()` plus locale-aware redirect to login.
- Clear the selected MindSpace ID during logout so another login does not inherit prior shell context.
- Do not add a backend logout endpoint or new auth behavior.

## EN/AR And RTL/LTR Handling

- Add app-shell, selector, state, and optional placeholder labels to the existing `auth` or a new concise `appShell` message namespace in both message files.
- Reuse the existing locale layout for `lang` and `dir`; do not duplicate direction logic in the shell.
- Use logical CSS/layout behavior that works under both directions and at mobile widths.

## Test And Validation Approach

- No frontend test framework is installed; do not add one.
- Run `npm run typecheck` and `npm run build` from `frontend/`.
- Manually verify authenticated load, selection, refresh persistence, stale-selection fallback, empty state, safe error, logout, EN/AR, RTL/LTR, keyboard selector use, and mobile/desktop layout.
- If test tooling exists by implementation time, add only focused behavior tests using that tooling.

## Scope Confirmation

This plan introduces no provider, global state library, generic API client, repository, adapter, factory, new auth framework, or new dependency. It adds no MindSpace CRUD and no Chat, Notes, Tasks, Documents, Search, Agent, Automation, Profile, Settings, Role, Permission, or nested MindSpace screens. Any navigation placeholders remain non-functional.

## Complexity Tracking

No constitution violations. No complexity exceptions required.
