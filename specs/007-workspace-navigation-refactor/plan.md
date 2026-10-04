# Implementation Plan: T034 Workspace Shell, Navigation & Chat UX Refactor

**Branch**: `007-workspace-navigation-refactor` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-workspace-navigation-refactor/spec.md`

## Summary

Refactor the protected frontend into locale-prefixed Chat, Documents, Tasks, Notes, and Memories routes under one persistent `AppShell`, while intentionally introducing Tailwind CSS and shadcn/ui for the new workspace shell and Chat interface. Authentication, logout, onboarding, MindSpace ownership, existing feature API contracts, and existing Documents/Tasks/Notes behavior remain unchanged.

Tailwind becomes the primary styling approach for new T034 workspace and Chat UI. shadcn/ui provides selected accessible primitives for shell navigation, Header controls, mobile Sheets, buttons, selection/account controls, email identity, and carefully chosen scroll/tooltip affordances. Existing global CSS remains in place for legacy/existing feature UI and public auth pages; T034 is not a full CSS or visual redesign.

Chat remains the highest-priority UI migration area. Its implementation must preserve the authoritative bounded-height and scrolling contract: complete `min-height: 0` shrink chain, independent conversation/message overflow, always-accessible composer, 80px near-bottom behavior, protection for deliberate upward reading, and request cleanup on unmount. shadcn primitives are subordinate to those behavioral requirements.

## Technical Context

**Language/Version**: TypeScript 5.7 with Next.js 16 App Router and React 19

**Primary Dependencies**: Existing `next`, `react`, `react-dom`, `next-intl`, and Playwright packages; add Tailwind CSS using the current compatible Next.js setup; initialize shadcn/ui for the existing App Router frontend; add only dependencies required by selected shadcn primitives such as Sheet, Button, Select, DropdownMenu, Avatar, Tooltip, and ScrollArea where justified

**Storage**: Existing `sessionStorage` keys for authentication and selected MindSpace; backend-owned feature data remains accessed through existing NestJS API modules; no new persistence

**Testing**: Existing Playwright 1.63 Chromium setup, TypeScript `tsc --noEmit`, Next.js production build, focused manual EN/AR desktop/mobile visual and interaction checks

**Target Platform**: Modern desktop and mobile web browsers supported by the current Next.js application; dynamic viewport units with `100vh` fallback

**Project Type**: Existing Next.js frontend backed by NestJS

**Performance Goals**: One shell-level MindSpace load per mounted workspace document; no shell reload solely from sibling route navigation; bounded Chat document height with 50 conversations and 100 messages; direct scroll measurements/writes only on the accepted message scroll host; no polling, server-state cache, virtualization, or speculative prefetching

**Constraints**: Preserve existing auth/logout/onboarding and feature contracts; use real locale child routes; one shell-owned MindSpace state; public pages remain normal document flow; English LTR and Arabic RTL; Tailwind/shadcn scope limited to new workspace shell and Chat UI; existing global CSS remains for legacy UI; no backend/profile change, unrelated component library, global state library, direct internal-service access, or full design-system migration

**Scale/Scope**: Five protected workspace sections, two locales, one selected MindSpace, one active route feature, finite existing feature lists, one desktop shell, two independent shadcn Sheet-based mobile panels, controlled Tailwind/shadcn migration for workspace and Chat, and focused regression coverage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Simplicity: PASS with documented exception for approved UI dependencies. The route/state design reuses `AppShell`, existing features, existing API modules, and one small context. Tailwind and shadcn/ui are intentionally introduced by the updated T034 spec for the new shell and Chat only; they are not used to migrate the entire frontend.
- Readability: PASS. `AppShell` remains the single MindSpace owner. `WorkspaceSidebar`, `WorkspaceHeader`, a minimal `workspace-context`, and shadcn `components/ui/*` primitives keep shell presentation and shared primitive code focused. Chat remains one feature component unless implementation size forces a responsibility split around conversation pane/message pane/composer.
- API boundary: PASS. Existing frontend modules continue to call only NestJS. Memories performs no request. Tailwind/shadcn setup does not introduce Agent, RAG, Qdrant, PostgreSQL, Supabase, storage, or profile calls.
- Backend authority: PASS. MindSpace ownership and feature data remain backend-authoritative. The frontend revalidates stored selection against `GET /api/v1/mindspaces` and never sends `userId`.
- User states: PASS. Existing loading, empty, success, and error states remain in each feature. Chat loading/empty/error states are restyled with Tailwind/shadcn without changing behavior. Shell loading/empty/error gates remain ahead of active feature mounting.
- Accessibility and responsive design: PASS. shadcn primitives are selected primarily for accessible controls and Sheets. The plan still requires semantic navigation/main landmarks, `aria-current`, keyboard operation, focus transfer/restoration, EN/AR strings, inherited RTL direction, mobile usability, and verified Chat scroll containment.
- Dependencies and state: PASS with approved dependency scope. New dependencies are limited to Tailwind CSS setup, shadcn/ui initialization, and selected shadcn primitive dependencies required for T034. No Redux, Zustand, query/cache library, unrelated component library, or broad icon pack is planned.
- Testing: PASS. Focused Playwright behavior and geometry assertions cover route, state, lifecycle, scroll containment, mobile Sheets, and RTL risks without testing private implementation details or utility class names.

Post-design re-check: PASS. The updated design incorporates Tailwind/shadcn as approved T034 scope while preserving constitution principles through strict dependency limits, no backend change, no full legacy migration, explicit Chat scroll-host testability, and focused regression coverage. No unresolved constitution violation remains.

## Project Structure

### Documentation (this feature)

```text
specs/007-workspace-navigation-refactor/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── workspace-ui.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── globals.css                  # Existing legacy CSS plus Tailwind entry/directives and theme variables
│   └── [locale]/
│       ├── layout.tsx               # Existing locale provider and document direction; unchanged unless metadata is needed
│       └── app/
│           ├── layout.tsx           # New persistent AuthGate + AppShell boundary
│           ├── page.tsx             # Locale-preserving server redirect to Chat
│           ├── chat/page.tsx        # Thin selected-MindSpace route adapter
│           ├── documents/page.tsx   # Thin selected-MindSpace route adapter
│           ├── tasks/page.tsx       # Thin selected-MindSpace route adapter
│           ├── notes/page.tsx       # Thin selected-MindSpace route adapter
│           └── memories/page.tsx    # Translated Coming Soon placeholder
├── components/
│   ├── ui/                          # shadcn/ui primitives selected for T034
│   │   ├── avatar.tsx
│   │   ├── button.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── scroll-area.tsx          # Use only where it does not hide Chat scroll measurement
│   │   ├── select.tsx
│   │   ├── sheet.tsx
│   │   └── tooltip.tsx
│   ├── app-shell.tsx                # Refactored single shell/MindSpace owner and child slot
│   ├── workspace-context.tsx        # Minimal selected-MindSpace provider/hook
│   ├── workspace-sidebar.tsx        # Tailwind + shadcn navigation and mobile Sheet trigger/content
│   ├── workspace-header.tsx         # Tailwind + shadcn controls, selector, identity, account/logout
│   ├── chat.tsx                     # Tailwind + shadcn Chat UI with explicit native scroll hosts
│   ├── auth-gate.tsx                # Existing protected client boundary; reused
│   ├── create-mindspace.tsx         # Existing onboarding/additional creation; reused
│   ├── documents.tsx                # Existing feature; legacy CSS retained unless minimal wrapper needed
│   ├── tasks.tsx                    # Existing feature; legacy CSS retained unless minimal wrapper needed
│   └── notes.tsx                    # Existing feature; legacy CSS retained unless minimal wrapper needed
├── lib/
│   ├── utils.ts                     # shadcn class-name utility
│   ├── auth-state.ts                # Existing session auth; reused
│   ├── mindspace-selection.ts       # Existing selection persistence; reused
│   └── api/                         # Existing NestJS contracts; no new API module
├── messages/
│   ├── en.json                      # Workspace, panel, and placeholder strings
│   └── ar.json                      # Matching Arabic strings
├── components.json                  # shadcn/ui configuration
├── package.json                     # Add approved Tailwind/shadcn dependencies/scripts only as required
├── postcss.config.*                 # Tailwind-compatible setup if required by selected version
├── tailwind.config.*                # Tailwind config if required by selected version/shadcn setup
└── tests/
    ├── onboarding.spec.ts           # Minimal redirect/selector expectation updates
    └── workspace.spec.ts            # Focused route, layout, lifecycle, responsive, RTL regressions
```

**Structure Decision**: Keep the existing shallow frontend layout. Add route pages because the approved URL architecture requires them, extract only shell presentation components needed by T034, add one small context because App Router child pages cannot otherwise consume shell-owned client state, and add shadcn primitives under the conventional `components/ui` folder. Existing API modules and current legacy feature components remain in place.

## Phase 0 Decisions

Detailed decisions and rejected alternatives are recorded in [research.md](./research.md). The implementation-critical outcomes are:

- Keep `frontend/app/[locale]/app/layout.tsx` as a Server Component that composes client `AuthGate` and client `AppShell`; sibling navigation preserves the client subtree.
- Implement `frontend/app/[locale]/app/page.tsx` as an async Server Component that awaits locale params and redirects to the locale Chat route.
- Install/configure Tailwind CSS for the existing Next.js 16 frontend before shell/Chat UI work. Preserve existing global CSS for legacy UI and add Tailwind without a full CSS migration.
- Initialize shadcn/ui for the existing App Router structure and configure tokens/classes to Priora's warm/light surfaces, dark restrained controls, rounded surfaces, and professional appearance.
- Use selected shadcn primitives for Button, Sheet, Select, DropdownMenu, Avatar, Tooltip, and ScrollArea only where useful. Do not blindly wrap every element in shadcn.
- Use shadcn Sheet for mobile workspace navigation and mobile Chat conversation navigation unless implementation inspection reveals a concrete incompatibility. Keep the two Sheets independent.
- Use a minimal protected-subtree React context for validated `selectedMindSpaceId`; thin client route pages consume it and mount one existing feature.
- Derive current section from `useSelectedLayoutSegment()`, not local active-tab state or locale string parsing.
- Establish the full viewport-to-scroll-region sizing chain with Tailwind utilities plus small CSS support where required. Keep the composer as a non-scrolling row rather than fixed/sticky positioning.
- For Chat message history, prefer a native overflow container if shadcn ScrollArea complicates direct `scrollTop`/`scrollHeight`/`clientHeight` measurement. Correct scroll behavior is more important than using a shadcn component.
- Measure exact remaining message distance before updates and use an 80 CSS-pixel near-bottom threshold. Apply scroll position in a post-render layout effect only for the accepted active context.
- Keep non-Chat routes on Main Content scrolling; existing Documents/Tasks/Notes/Login/Register/onboarding UI remains legacy-styled unless minimal integration wrappers are required.

## Phase 1 Design

### Tailwind And shadcn Foundation

1. Select the Tailwind setup compatible with the existing Next.js 16 frontend and current shadcn/ui guidance.
2. Add Tailwind entry/directives to `frontend/app/globals.css` without deleting existing legacy CSS.
3. Configure content/source scanning to include `frontend/app`, `frontend/components`, and other current frontend source files.
4. Initialize shadcn/ui with App Router conventions, the existing TypeScript path alias style, and `components/ui` output.
5. Configure theme tokens and utility classes to preserve Priora's warm background, cream/light cards, dark controls, rounded surfaces, restrained borders, and professional spacing.
6. Add only shadcn primitives selected for T034. If a primitive pulls a dependency, document that it is required by the selected primitive.
7. Verify legacy pages and feature components still receive their existing global CSS.

### Route And Client Boundaries

1. The locale layout continues to validate locale, load messages, and set `lang`/`dir`.
2. The workspace layout renders `AuthGate`, then `AppShell`, then the active route child.
3. `AuthGate` prevents the protected client subtree from rendering without a stored access token.
4. `AppShell` performs one owned-MindSpace load, validates the stored selection, and gates children until a valid selection exists.
5. Each data-feature page is a client adapter that reads the context and mounts exactly one feature with `mindSpaceId`.
6. A hard refresh remounts and revalidates shell state; sibling client navigation keeps the shell mounted but intentionally remounts feature-local state.

Do not add `template.tsx`, key the shell by pathname, inject route children by cloning, or move selected MindSpace into the URL.

### AppShell And Context Responsibilities

`AppShell` retains:

- MindSpace request status/list/selected ID;
- stored-selection validation and fallback;
- first/additional MindSpace creation visibility and success handling;
- logout and locale-preserving login replacement;
- authenticated email retrieval for Header presentation;
- workspace mobile Sheet open/close coordination;
- current route segment passed to Header/Sidebar;
- the provider around active child content.

`workspace-context.tsx` exposes only a validated non-null selected MindSpace ID through a focused hook. It does not expose feature data, auth mutation, route state, or API methods. Calling the hook outside the provider fails clearly during development rather than silently creating a second source of truth.

### Workspace Shell, Navigation, And Header

- Sidebar uses explicit `/${locale}/app/{segment}` links for the five approved sections and exact segment equality for `aria-current="page"`.
- `useSelectedLayoutSegment()` supplies the route-derived active section for links and Header title; null/unknown segments are not treated as Chat.
- Desktop navigation is a persistent Tailwind-styled shell region using semantic `<nav>` and shadcn Button/Tooltip affordances only where they improve clarity.
- Mobile workspace navigation uses shadcn Sheet at logical inline start. Sheet state is shell-local and independent from Chat conversation Sheet state.
- Header uses Tailwind and shadcn Button, Select, DropdownMenu, Avatar-style email identity, and Tooltip where useful. It displays email only and may derive an initial from email; it does not request or fabricate name/avatar data.
- Route activation closes the workspace Sheet and transfers focus to Main Content/section heading. Dismissal without route change restores focus to the menu opener.

### Workspace And Feature Overflow

- The workspace root uses `100vh` then `100dvh`, `overflow: hidden`, and a desktop `sidebar + minmax(0, 1fr)` grid expressed primarily with Tailwind utilities.
- The workspace column uses `header + minmax(0, 1fr)`. Main Content and every necessary descendant receive zero minimum block/inline size.
- Main Content is the normal vertical scrolling owner for Documents, Tasks, Notes, and Memories.
- Chat opts into a full-height overflow-hidden route wrapper. Its panes use fixed-content rows plus `minmax(0, 1fr)` scrolling rows.
- Conversation and message scroll hosts use native overflow where direct measurement is required, horizontal clipping/wrapping, and contained overscroll. The composer remains the last non-scrolling row and its textarea has bounded growth.
- No workspace overflow rule targets global `body` or public-page classes.

### Chat Tailwind/shadcn Implementation Approach

- Chat's new layout, conversation pane, message pane, composer, mobile conversation Sheet, and visible states use Tailwind as the primary styling mechanism.
- Use shadcn Button for create/send/menu actions, Sheet for the mobile conversation panel, Select/DropdownMenu only where it directly improves an existing control, Tooltip for compact controls where useful, and Avatar only for user identity outside Chat unless a message identity mark is justified.
- Use shadcn ScrollArea only for conversation lists or non-critical overflow regions if it preserves access to the actual scroll element. For the message history region, use a normal native overflow container unless ScrollArea can expose the measured element without indirection or behavioral risk.
- Keep one stable message scroll host mounted for idle/loading/empty/error/success to provide a stable ref and measurement surface.
- Track near-bottom state, pending post-render scroll plan, active conversation, current MindSpace, and request identities in refs.
- Near bottom is `max(0, scrollHeight - clientHeight - scrollTop) <= 80` on the actual message scroll host.
- Initial accepted load for a newly opened/switched conversation schedules one forced-bottom write after render.
- Same-conversation refresh schedules bottom only when measured near bottom before applying new messages.
- Send captures near-bottom at submit and measures again immediately before accepted refreshed messages are applied. Either true value schedules bottom; otherwise no scroll write occurs.
- Manual scrolling updates the near-bottom ref. Returning within threshold restores subsequent pinning.
- Conversation and MindSpace changes reset scroll intent; MindSpace changes also retain all current Chat data/draft/request reset behavior.
- Chat effect cleanup increments all request identities. Every continuation still checks request identity, expected MindSpace, and expected conversation before data or scroll-plan changes.
- Preserve current unauthorized and 404 behavior. A stale request from a replaced auth session cannot clear the newer session.

### Mobile Sheets

- Workspace navigation uses one shadcn Sheet controlled by `AppShell`/`WorkspaceSidebar`.
- Chat conversation navigation uses one separate shadcn Sheet controlled by `Chat`.
- The two Sheets have distinct state, IDs, triggers, focus destinations, and close handlers.
- Opening or closing either Sheet does not mutate the other component's route/selection model. Coordination to close an already-open Sheet before opening another is presentation behavior only and must not merge state.
- Sheet placement uses inherited `dir` and Tailwind logical/RTL-safe styling. If shadcn Sheet defaults need side-specific configuration, choose side based on locale/document direction without creating a second direction state system.
- Selecting a Chat conversation closes only the Chat Sheet and transfers focus to the conversation heading or message region.

### Existing Feature Migration

- Documents, Tasks, and Notes route adapters pass the context ID to their existing components. Their API modules, request payloads, loading/error states, validation, and behavior remain unchanged.
- Existing feature components may retain global CSS. Minimal Tailwind wrapper spacing is allowed only when needed for correct rendering inside the workspace shell.
- Existing `key={feature-selectedId}` behavior is not required after route migration because each feature already resets on `mindSpaceId`; preserve a key only where a verified existing behavior depends on remounting.
- Memories is static translated content and creates no `lib/api/memories.ts`.

### Testing Design

- Add one isolated `workspace.spec.ts` with shared helpers local to that file; do not make tests serial or share mutable state across tests.
- Intercept `**/api/v1/**`, parse exact path/method/query, record calls, verify bearer auth, and return an explicit failure for unexpected endpoints.
- Seed auth and selected MindSpace with `page.addInitScript`; use two MindSpaces and deterministic records/timestamps.
- Use fixed desktop `1440x900` and mobile `390x844` viewports, 50 conversations, and at least 100 sufficiently long messages.
- Assert route behavior through URL, landmarks/headings, and `aria-current`; assert containment through computed overflow, scroll dimensions, and bounding boxes with 1-2 pixel tolerance.
- Assert actual scroll-host behavior, not Tailwind class names or shadcn component presence.
- Use `expect.poll` for layout-effect outcomes and controlled deferred responses for stale/unmount/send timing. Do not use arbitrary sleeps, `networkidle`, color checks, screenshots as primary assertions, or synthetic wheel behavior.

## Existing API Contracts

No API contract changes are planned. Existing calls remain:

- `GET /api/v1/mindspaces` and `POST /api/v1/mindspaces` for shell-owned selection/onboarding.
- `GET /api/v1/conversations?mindSpaceId={id}` and `POST /api/v1/conversations` for Chat conversations.
- `GET /api/v1/conversations/{conversationId}/messages` and `POST /api/v1/conversations/{conversationId}/messages` for history/send.
- `GET /api/v1/documents?mindSpaceId={id}` and `POST /api/v1/documents` for existing list/PDF upload.
- `GET /api/v1/tasks?mindSpaceId={id}` and `POST /api/v1/tasks` for existing list/create.
- `GET /api/v1/notes?mindSpaceId={id}`, `POST /api/v1/notes`, and `GET /api/v1/notes/{noteId}` for existing Notes behavior.

Every request continues to use the existing bearer token and sends no `userId`. See [contracts/workspace-ui.md](./contracts/workspace-ui.md) for the route, state, styling scope, overflow, and accessibility contracts.

## Dependency-Ordered Implementation Phases

1. **Tailwind/shadcn foundation**: Add Tailwind CSS using the appropriate Next.js 16-compatible setup, add Tailwind entry/directives without deleting existing CSS, initialize shadcn/ui for App Router, add `components.json`, `lib/utils.ts`, initial theme tokens, and selected primitives needed by T034.
2. **Route skeleton and redirect**: Create the shared workspace layout and five child pages; change `frontend/app/[locale]/app/page.tsx` to redirect to locale Chat; verify direct child URLs compile and preserve locale.
3. **Shared shell boundary**: Add the minimal workspace context and refactor `AppShell` into the persistent child-content boundary while preserving all MindSpace/onboarding/logout states.
4. **Tailwind/shadcn Header and Sidebar**: Add `WorkspaceSidebar` and `WorkspaceHeader` using route-derived active state, EN/AR messages, shadcn Button/Select/DropdownMenu/Avatar/Tooltip where justified, and shadcn Sheet for mobile workspace navigation.
5. **Feature route migration**: Move Documents, Tasks, and Notes behind thin route adapters and add Memories placeholder; preserve existing API behavior and legacy CSS for those existing features.
6. **Workspace containment foundation**: Add Tailwind-based workspace viewport, grid/flex shrink chain, Main Content overflow behavior, desktop Sidebar/Header layout, and RTL-safe placement; verify public routes are unaffected.
7. **Desktop Chat Tailwind/shadcn containment**: Refactor Chat UI using Tailwind and selected shadcn primitives while keeping explicit native scroll hosts for message history if needed; add effect cleanup; verify current Chat behavior before adding automatic scrolling.
8. **Chat scroll behavior**: Add the 80-pixel near-bottom policy, deterministic scroll-host refs, reading-position preservation, conversation/MindSpace resets, and desktop Playwright coverage.
9. **Mobile workspace Sheet**: Complete shadcn Sheet-based workspace navigation focus, close, route activation, touch sizing, and RTL behavior; verify it remains independent of Chat state.
10. **Mobile Chat conversation Sheet**: Replace vertical mobile conversation stacking with a Chat-local shadcn Sheet/panel; define initial no-selection behavior, close/focus behavior after selection, and message/composer viewport access.
11. **Regression and scope cleanup**: Update affected onboarding expectations, complete route/state/logout/direct-refresh/RTL tests, run validation in `quickstart.md`, and confirm no backend, API-contract, unrelated dependency, full legacy migration, or out-of-scope feature changes entered the diff.

## Verification Gates

- After phase 1: Tailwind compiles, shadcn primitives import correctly, legacy public pages still render with existing styles, and no unrelated dependencies are present.
- After phases 2-4: route, active state, auth, MindSpace restore/fallback/create, Header/Sidebar, mobile workspace Sheet, and logout tests pass.
- After phase 5: existing Documents/Tasks/Notes behavior passes on dedicated routes and no inactive feature endpoint is called.
- After phases 6-8: desktop document height, independent overflow, explicit message scroll-host measurement, composer visibility, initial/switch bottom, threshold, upward-reading, and stale/unmount tests pass.
- After phases 9-10: mobile Sheet focus, Escape/close, route/selection transfer, Sheet independence, RTL placement, safe width, and composer access pass.
- Final: `npm run typecheck`, `npm run build`, `npm test`, focused manual EN/AR visual checks, dependency/scope review, and changed-file whitespace checks pass.

## Complexity And Dependency Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| Add Tailwind CSS | Approved T034 architecture decision for new workspace and Chat UI; enables controlled utility-first layout and styling for the bounded shell. | Continuing global CSS only conflicts with the updated specification. |
| Add shadcn/ui selected primitives | Approved T034 architecture decision; provides accessible Sheet, Button, Select/DropdownMenu, Avatar, Tooltip, and optional ScrollArea primitives for the new shell and Chat. | Native `<dialog>` and fully custom controls are obsolete planning decisions and conflict with the approved spec. |
| Retain legacy global CSS alongside Tailwind | Prevents unnecessary migration risk for Documents, Tasks, Notes, Login, Register, and onboarding. | Full CSS migration is explicitly out of scope and would increase regression risk. |
| Native message scroll host when needed | Preserves direct `scrollTop`/`scrollHeight`/`clientHeight` measurement required by the Chat contract. | Blind shadcn ScrollArea usage may hide the measured element and weaken deterministic scroll behavior. |

No backend, API, global state, profile, Memories CRUD, or unrelated component-library complexity is introduced.
