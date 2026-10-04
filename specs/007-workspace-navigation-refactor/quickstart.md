# Quickstart: T034 Workspace Shell, Navigation & Chat UX Refactor

## Prerequisites

- Use branch `007-workspace-navigation-refactor`.
- Install existing frontend dependencies and Playwright Chromium.
- Apply the approved Tailwind CSS and shadcn/ui setup before implementing new workspace shell or Chat UI.
- Keep existing session-storage keys and NestJS API contracts unchanged.
- Use test fixtures with two MindSpaces, records for each existing feature, 50 conversations, and at least 100 messages in one conversation.
- Use English and Arabic fixtures containing long labels/content for overflow checks.

## Implementation Order

Follow the dependency phases in [plan.md](./plan.md). Tailwind/shadcn setup comes first. Do not start mobile Sheets before persistent routing/MindSpace state and desktop containment work correctly. Do not perform a full legacy CSS migration.

## Automated Validation

Run from `frontend/`:

```powershell
npm run typecheck
npm run build
npm test
```

Run changed-file whitespace validation from the repository root. Repository-wide `git diff --check` currently also reports pre-existing whitespace in unrelated `agent-service` files, so do not modify or claim those issues as T034 changes.

## Tailwind/shadcn Validation

1. Confirm Tailwind compiles in the Next.js 16 frontend build.
2. Confirm shadcn primitives import from the configured `components/ui` paths.
3. Confirm new workspace shell and Chat UI use Tailwind as the primary styling approach.
4. Confirm shadcn Sheet is used for mobile workspace navigation and mobile Chat conversation navigation unless a concrete incompatibility is documented.
5. Confirm shadcn Button, Select, DropdownMenu, Avatar, Tooltip, and ScrollArea are used only where they provide clear value.
6. Confirm the message history scroll host remains directly measurable through `scrollTop`, `scrollHeight`, and `clientHeight`; use native overflow if ScrollArea interferes.
7. Confirm existing global CSS still styles Login, Register, onboarding, Documents, Tasks, and Notes.
8. Confirm Priora's warm/light surfaces, dark controls, rounded surfaces, and restrained professional appearance are preserved.

## Route And Shell Validation

1. Open `/en/app` and confirm final URL `/en/app/chat`.
2. Enter `/en/app/documents`, `/tasks`, `/notes`, `/memories`, and `/chat` directly; refresh each and confirm the matching active link/section remains.
3. Repeat locale preservation on `/ar/app` and all Arabic section links.
4. Navigate all five Sidebar links; confirm one active `aria-current="page"` and one feature section at a time.
5. Use browser back/forward and confirm URL, Header title, active state, and route content update together.
6. Confirm no sibling route navigation causes another shell-level MindSpace GET.
7. Select a second MindSpace, navigate at least Chat -> Documents -> Tasks -> Memories -> Chat, and confirm selector and session storage remain on the second ID.
8. Refresh and confirm the same valid selection is restored; then return a list without that ID and confirm first-item fallback is persisted.
9. Start with no MindSpaces; confirm onboarding blocks feature requests, failed creation can retry, and successful creation unlocks the current child feature.
10. Log out from a non-Chat route; confirm auth/selection storage are absent and same-locale login is active.
11. Load a direct child without auth; confirm same-locale login and zero child-feature request.

## Existing Feature Validation

1. Documents route preserves PDF selection validation, upload loading/success/error, listing, and `PROCESSING`/`READY`/`FAILED` labels. Confirm no delete, preview, download, or polling.
2. Tasks route preserves current list/create payloads, states, ordering, stale guards, and no expanded task controls.
3. Notes route preserves current list/create/open behavior, states, stale guards, and no expanded note controls.
4. Memories route shows only translated placeholder content and makes no Memories request.
5. Navigate away with a local draft/selection and return; confirm remount/reset behavior matches the documented feature-local lifecycle rather than introducing hidden persistence.

## Desktop Chat Validation

Use `1440x900` with 50 conversations and at least 100 long messages.

1. Confirm document height is at most `innerHeight + 2` and width is at most viewport width plus 1 pixel.
2. Confirm Header and composer bounding boxes are fully within the viewport.
3. Confirm conversation and message scroll hosts each have `scrollHeight > clientHeight` and computed vertical overflow `auto` or `scroll`.
4. Confirm the message scroll host is the element used for `scrollTop`/`scrollHeight`/`clientHeight` measurements, regardless of whether shadcn ScrollArea appears elsewhere.
5. Scroll conversations and confirm message `scrollTop` and composer geometry do not move.
6. Scroll messages and confirm conversation `scrollTop` does not move.
7. Open conversation A and confirm remaining message distance reaches at most 1 pixel; scroll upward, open B, and confirm B reaches its own bottom.
8. Establish a measured remaining distance of 80 pixels or less, send/refresh, and confirm bottom pinning.
9. Establish a measured distance above 80 pixels, send/refresh, and confirm `scrollTop` is preserved within 2 pixels.
10. Begin send above threshold, hold refresh, return near bottom, release refresh, and confirm bottom pinning.
11. Switch MindSpaces while a message response is held; release it and confirm old content/state cannot enter the new context.
12. Leave Chat while a request is held; release it and confirm destination UI remains unchanged and no page error occurs.
13. Repeat existing create/open/send validation, safe errors, unauthorized redirect, and 404 active-conversation reset.

## Mobile And Accessibility Validation

Use `390x844`.

1. Confirm workspace-menu button starts collapsed, controls the correct shadcn Sheet, and opens with focus inside.
2. Tab and Shift+Tab through the open Sheet to confirm modal focus behavior; press Escape and confirm focus returns to its opener.
3. Reopen and activate a destination; confirm Sheet closes, URL/active state changes, and focus moves to new Main Content.
4. In Chat, confirm the conversation control references a different Sheet ID/state. Open it, select a conversation, and confirm focus moves to the message pane/heading.
5. Open and close workspace navigation after selecting a conversation; confirm active conversation, messages, and composer state remain unchanged.
6. Confirm long conversation data never stacks above the composer and both Sheet list/message regions remain independently usable.
7. Confirm all controls have visible focus, labels, touch-usable sizing, and no horizontal overflow.
8. Confirm composer bottom remains within the viewport/safe-area edge before and after list scrolling and send.

## Arabic/RTL Validation

1. Confirm `/ar/app/chat` has `html[lang="ar"][dir="rtl"]` and Arabic navigation/Header/panel/placeholder strings.
2. Confirm every destination remains `/ar/...` and the active link is programmatically exposed.
3. On desktop, confirm Sidebar occupies logical inline start on the right.
4. On mobile, confirm workspace and conversation Sheets enter from/align to logical inline start on the right.
5. Confirm long Arabic content wraps without horizontal document overflow.

## Public Page Regression

1. Open Login and Register at desktop/mobile heights with validation errors.
2. Confirm they remain ordinary document pages and can grow/scroll vertically.
3. Confirm no workspace overflow, fixed-height, Sheet, or safe-area class affects them.

## Scope Review

Confirm the final diff contains:

- no backend file change;
- no unapproved runtime dependency beyond Tailwind/shadcn and selected primitive dependencies;
- no API contract or `userId` change;
- no profile/name/avatar behavior;
- no Memories API or CRUD;
- no expanded Documents, Tasks, Notes, or Chat capability;
- no full Tailwind/shadcn migration of legacy screens;
- no unrelated component library or broad icon library;
- no global body overflow lock;
- no global state or query/cache library.

## Expected Playwright Practices

- Route all `/api/v1/**` calls and fail unexpected path/method combinations explicitly.
- Seed auth/selection with `page.addInitScript` before navigation.
- Use isolated mock state per test and fixed timestamps/content.
- Use `expect.poll` for post-render scroll/layout outcomes.
- Measure actual remaining scroll distance before boundary assertions.
- Use 1-2 pixel tolerances for browser geometry.
- Avoid `waitForTimeout`, `networkidle`, screenshot-only assertions, computed-color active checks, exact wrapping dimensions, hidden breakpoint controls, or assertions that depend on Tailwind class names rather than behavior.

## Validation Results

- Planning artifact completeness: PASS after Tailwind/shadcn plan refresh on 2026-10-04.
- Constitution pre-design and post-design gates: PASS with approved dependency scope.
- Frontend typecheck: PASS via `npm run typecheck` on 2026-10-04.
- Frontend production build: PASS via `npm run build` on 2026-10-04.
- Current Playwright suite: PASS via `PLAYWRIGHT_BASE_URL=http://localhost:3001 npm test` on 2026-10-04 after updating onboarding assertions for shadcn Select and route heading semantics.
- Dependency scope review: PASS; runtime additions are limited to approved Tailwind/shadcn/Radix primitives and class utilities.
- Chat scroll-host review: PASS; message history uses a native measurable `div` ref for `scrollTop`, `scrollHeight`, and `clientHeight`.
- Global overflow review: PASS; workspace containment is scoped to `.workspace-shell`, with no global `body` overflow lock affecting Login/Register.
- Changed frontend/spec whitespace scan: PASS; no trailing whitespace found in changed frontend source/config or `specs/007-workspace-navigation-refactor/*.md` files.
- Manual EN/AR visual inspections: pending.
