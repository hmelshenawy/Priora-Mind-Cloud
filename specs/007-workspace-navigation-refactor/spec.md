# Feature Specification: T034 Workspace Shell, Navigation & Chat UX Refactor

**Feature Branch**: `007-workspace-navigation-refactor`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "T034 — Workspace Shell, Navigation & Chat UX Refactor. Refactor the protected single-page dashboard into locale-prefixed workspace routes with a persistent shell, responsive navigation, shared MindSpace context, and bounded Chat scrolling while preserving existing behavior."

## 1. Objective

Transform the authenticated Priora Mind Cloud area from one vertically stacked dashboard into a route-based personal AI workspace. The result must retain the existing authentication, logout, MindSpace, onboarding, Chat, Documents, Tasks, and Notes behavior while giving each feature a dedicated locale-prefixed destination inside one persistent application shell.

T034 is a frontend architecture and usability refactor. It must reuse the current features and backend contracts, keep public authentication pages in normal document flow, and make Chat operate within the usable viewport rather than increasing document height as message history grows.

Architecture decision: T034 deliberately introduces Tailwind CSS and shadcn/ui for the new workspace shell and Chat interface. This is a controlled styling migration for T034-specific UI, not a full frontend redesign. Existing Documents, Tasks, Notes, Login, Register, and onboarding UI may continue using existing global CSS unless minimal integration changes are required for correct rendering inside the new workspace shell.

## 2. Current State

- `frontend/app/[locale]/app/page.tsx` renders `AuthGate` and `AppShell` at one protected route.
- `frontend/components/app-shell.tsx` loads MindSpaces, restores and validates the session-stored selection, handles onboarding and logout, and then mounts `Documents`, `Chat`, `Notes`, and `Tasks` together in a fixed vertical order.
- `frontend/components/chat.tsx` owns conversation, active-conversation, message, composer, and request-identity state. Its MindSpace effect invalidates requests when the MindSpace changes but does not invalidate them on component unmount.
- `frontend/app/globals.css` gives the shell and feature panels normal document-flow sizing. Chat uses a two-column grid on desktop and stacks both panes on mobile, but no bounded height chain makes the message list the scrolling owner. The frontend is not currently configured for Tailwind CSS or shadcn/ui.
- `frontend/components/documents.tsx`, `frontend/components/notes.tsx`, and `frontend/components/tasks.tsx` are already self-contained, MindSpace-scoped features with their existing loading and failure behavior.
- `frontend/lib/auth-state.ts` stores the access token and only `user.id` and `user.email`. No profile name or avatar exists.
- `frontend/app/[locale]/layout.tsx` already supplies locale messages and sets document `lang` and `dir`; `frontend/i18n/routing.ts` defines `en` and `ar`.
- `frontend/messages/en.json` and `frontend/messages/ar.json` contain existing feature strings but not complete workspace navigation, header, drawer, or Memories-placeholder strings.
- `frontend/tests/onboarding.spec.ts` and `frontend/playwright.config.ts` provide an existing Playwright regression setup. Some tests navigate directly to `/{locale}/app` and therefore must remain valid through the new redirect.

## 3. Target UX

Authenticated users enter a persistent workspace composed of a workspace Sidebar, a Header, and one Main Content region. Navigation changes the child route and renders only that route's feature. The shell remains present while moving among sibling workspace sections, so authentication and current MindSpace context remain continuous.

Desktop users see a persistent workspace navigation sidebar and header. Mobile users see a compact header with a workspace-menu control that opens navigation as a temporary drawer. Chat additionally owns a separate mobile conversation control; the two controls and their state must remain independent.

The established warm background, cream surfaces, dark controls, rounded corners, typography, and spacing remain recognizable. Tailwind utilities and shadcn/ui primitives must be themed to Priora's existing visual identity rather than imposing a visual rebrand. T034 improves hierarchy, containment, and navigation while introducing a controlled new UI implementation path for workspace and Chat surfaces.

### User Scenarios & Testing

### User Story 1 - Navigate A Persistent Workspace (Priority: P1)

An authenticated user can move between Chat, Documents, Tasks, Notes, and Memories using visible workspace navigation while retaining the current locale and MindSpace.

**Why this priority**: Route-based section navigation is the architectural foundation of the refactor and removes the current long dashboard.

**Independent Test**: Open `/{locale}/app`, follow each section link, use browser back and forward, and refresh a child route while confirming the shell, active navigation, locale, and selected MindSpace remain correct.

**Acceptance Scenarios**:

1. **Given** an authenticated English user opens `/en/app`, **When** routing completes, **Then** the user is at `/en/app/chat` with Chat as the only feature section rendered.
2. **Given** an authenticated user has selected a MindSpace, **When** the user follows the Documents link, **Then** the URL changes to the locale-preserving Documents route and the same MindSpace is current.
3. **Given** a user is on a child section route, **When** the user refreshes or uses browser back or forward, **Then** the route, shell, active section, and valid selected MindSpace are restored correctly.

---

### User Story 2 - Use Long Chats Without Losing Controls (Priority: P1)

An authenticated user can open and continue a long conversation while the workspace navigation, header, conversation controls, and composer remain reachable and message history scrolls within its pane.

**Why this priority**: Chat viewport containment is a major acceptance area and corrects the primary application-like UX failure identified by the audit.

**Independent Test**: Load enough conversations and messages to exceed the viewport, verify independent pane scrolling, send a message, and confirm document height does not grow with message count and the composer stays accessible.

**Acceptance Scenarios**:

1. **Given** a desktop viewport and a conversation with long history, **When** Chat renders, **Then** the workspace fits the usable viewport, the message list scrolls independently, and the composer remains visible.
2. **Given** the conversation list exceeds its available height, **When** the user scrolls it, **Then** it scrolls independently without moving the header or message composer out of view.
3. **Given** the user has deliberately scrolled upward in message history, **When** same-conversation messages refresh after sending, **Then** the viewport is not forced to the bottom unless the user was already near the bottom.

---

### User Story 3 - Use Workspace And Chat On Mobile (Priority: P2)

A mobile user can open temporary workspace navigation and separately access Chat conversations without either panel permanently consuming width or pushing the composer below a long list.

**Why this priority**: Mobile stacking currently allows long conversation content to displace the primary chat interaction.

**Independent Test**: At a supported mobile viewport, open and close the workspace drawer, enter Chat, open the conversation control, select a conversation, and send a message without horizontal overflow or page-length displacement.

**Acceptance Scenarios**:

1. **Given** a mobile viewport, **When** the user opens the workspace menu, **Then** a temporary locale-direction-aware drawer appears, receives focus, and can be dismissed without changing Chat conversation state.
2. **Given** mobile Chat with many conversations, **When** the user opens the conversation panel and selects one, **Then** the panel closes and the bounded message pane and composer become usable immediately.
3. **Given** Arabic is active, **When** either mobile panel opens, **Then** placement, animation direction, reading order, labels, and focus behavior follow RTL without a second direction setting.

---

### User Story 4 - Retain Existing Feature Behavior (Priority: P2)

An authenticated user can use Documents, Tasks, Notes, logout, and MindSpace onboarding from their new locations without losing existing functionality.

**Why this priority**: The refactor must not regress shipped behavior or expand feature scope.

**Independent Test**: Exercise the existing feature and onboarding flows on their dedicated routes and compare their requests, states, and outcomes with current behavior.

**Acceptance Scenarios**:

1. **Given** a selected MindSpace, **When** the user opens Documents, Tasks, or Notes, **Then** the existing feature receives that MindSpace ID and retains its current behavior and API contract.
2. **Given** no MindSpaces exist, **When** the protected workspace loads, **Then** the existing first-MindSpace onboarding flow is presented and successful creation establishes the shared selection.
3. **Given** the user chooses logout from the header, **When** logout completes, **Then** authentication and selected MindSpace storage are cleared and the locale-preserving login route replaces the workspace.

### Edge Cases

- A stored MindSpace ID is absent from the latest owned MindSpace response; the first returned MindSpace becomes the fallback and replaces the stale stored value.
- No MindSpaces exist; feature content and feature requests remain unavailable until onboarding succeeds.
- MindSpace loading fails; the shell shows its existing safe failure state without mounting active feature content.
- Authentication is absent at a direct child URL or becomes unauthorized during an active feature request; existing locale-preserving login behavior applies.
- A user navigates away while Chat conversation or message requests are pending; late continuations cannot update the unmounted Chat or clear a newer authentication session.
- A conversation returns 404 while being opened or refreshed; existing active-conversation reset behavior remains intact.
- A user switches conversations or MindSpaces while message loading or sending is pending; stale results cannot replace the current context.
- Very long email addresses, MindSpace names, navigation labels, conversation titles, messages, task descriptions, note content, and filenames wrap or truncate safely without horizontal viewport overflow.
- Mobile browser chrome changes the visible viewport height; the workspace remains bounded to the currently usable viewport where supported.
- Public Login and Register routes continue to grow and scroll as ordinary document pages and are not affected by workspace overflow containment.

## 4. Target Route Architecture

The protected workspace route tree is:

```text
frontend/app/[locale]/app/
├── layout.tsx
├── page.tsx
├── chat/page.tsx
├── documents/page.tsx
├── tasks/page.tsx
├── notes/page.tsx
└── memories/page.tsx
```

- `/{locale}/app` must perform a replace-style redirect to `/{locale}/app/chat` for the same valid locale.
- `frontend/app/[locale]/app/layout.tsx` is the shared protected layout and state boundary. It composes the existing `AuthGate` with the refactored `AppShell` and renders child route content in the shell's Main Content region.
- Each child page renders only its own feature or placeholder. Primary section navigation uses links and route state, not local-state tabs.
- Direct navigation and refresh at every approved child URL must work when session authentication is valid and must follow existing login redirection when it is not.
- Unknown child paths keep the framework's normal not-found behavior; T034 does not add aliases or compatibility routes.
- The locale segment is always retained when constructing redirects and navigation destinations.

## 5. Target Component Architecture

```text
LocaleLayout
└── WorkspaceLayout
    └── AuthGate
        └── AppShell (shared MindSpace owner/provider)
            ├── WorkspaceSidebar (Tailwind + shadcn/ui)
            ├── WorkspaceHeader (Tailwind + shadcn/ui)
            └── Main Content
                └── active child route only
                    ├── Chat (Tailwind + shadcn/ui)
                    ├── Documents
                    ├── Tasks
                    ├── Notes
                    └── Memories placeholder
```

- Refactor the existing `frontend/components/app-shell.tsx`; do not create a second shell.
- Add focused `WorkspaceSidebar` and `WorkspaceHeader` components so shell responsibilities remain readable and reusable.
- Initialize and configure Tailwind CSS and shadcn/ui for the existing App Router frontend. Use Tailwind as the primary styling approach for new T034 workspace and Chat UI.
- Add shadcn/ui primitives only where they provide clear accessibility, interaction, or composition value. The expected priority primitives are Button, Sheet, Select or DropdownMenu controls, Avatar-style email identity, ScrollArea where it does not weaken overflow ownership, Tooltip where useful, and other small shadcn primitives justified during planning.
- The shell must expose the validated `selectedMindSpaceId` and only the minimal shared MindSpace data/actions required by active route pages. This can use React context colocated with the shell; no global state library is warranted.
- Route pages remain thin adapters: obtain the shared selected MindSpace ID, render the existing feature with `mindSpaceId`, and do not duplicate MindSpace fetching or selection.
- Chat conversation navigation stays inside `frontend/components/chat.tsx`. Workspace navigation and conversation navigation must not share open state, active IDs, item models, or reducers.

## 6. Workspace Shell Behavior

- The shell must include exactly one workspace Sidebar, one reusable Header, and one Main Content region.
- Existing authentication protection remains at the shared protected layout boundary, covering all child routes.
- Existing logout semantics remain available from the Header: clear auth storage, clear selected MindSpace storage, and replace the current route with `/{locale}/login`.
- MindSpace loading, validation, selection, persistence, and creation remain owned once by the refactored shell.
- While MindSpaces load, the workspace presents the translated shell loading state and does not mount child feature content with an invalid ID.
- When no MindSpaces exist, the current `CreateMindSpace` onboarding experience occupies the workspace content area. Sidebar links may remain visible, but feature content and feature API activity must not appear until creation succeeds.
- On MindSpace load failure, show the existing safe translated error and do not mount active feature content.
- On success, render only the current route's child content and pass it the current valid MindSpace ID.
- Workspace viewport containment applies only beneath `frontend/app/[locale]/app/layout.tsx`; it must not alter the body behavior of Login, Register, or locale landing pages.

## 7. Sidebar Behavior

- Desktop navigation contains Chat, Documents, Tasks, Notes, and Memories in that order within a semantic navigation landmark with a translated accessible label.
- Every destination is a locale-prefixed link. The active link is visually distinct and exposes `aria-current="page"`.
- Matching is based on the current child route, including after direct load, refresh, back, or forward navigation.
- The sidebar remains persistent at desktop widths and occupies a bounded shell column; it does not scroll the entire page when only navigation content overflows.
- Styling uses Tailwind utilities and shadcn/ui primitives while preserving current colors, rounded surfaces, borders, controls, typography, and spacing. No unrelated component library is introduced.
- On mobile, workspace navigation is removed from normal width allocation and opens as a temporary shadcn Sheet/drawer from the logical inline start: left in LTR and right in RTL.
- The mobile drawer starts closed on route entry. It closes after a destination is activated, when Escape is pressed, or when the dismiss backdrop/close control is activated.
- Opening the drawer moves focus to its first meaningful control or close control, prevents interaction with obscured workspace content, contains keyboard focus, and preserves the triggering button for focus restoration on close.
- Workspace drawer state is shell-local and independent from Chat's mobile conversation panel state. Opening one must not mutate the other's selection model.

## 8. Header Behavior

- The reusable Header displays the translated current section title determined from the active route.
- It presents the selected MindSpace and the existing selector when MindSpaces are available, plus the existing additional-MindSpace creation action where appropriate.
- It displays authenticated identity using `user.email`. A single initial derived from the first displayable email character may be used as a decorative identity mark, but the UI must not infer or display a personal name.
- It provides the existing logout/account action without adding profile editing, account settings, avatar upload, or backend profile requests.
- Header controls should use shadcn Button, Select or DropdownMenu primitives, Avatar/email identity presentation, and Tooltip where useful, provided these primitives do not add backend/profile assumptions.
- On mobile, the workspace-menu button remains reachable in the Header and exposes an accessible name, `aria-expanded`, and `aria-controls` for the workspace drawer.
- Header controls must wrap or compact without horizontal overflow. The section title, menu control, MindSpace selector, email identity, and logout action remain operable at supported widths, even if lower-priority identity text is visually condensed with an accessible label retained.

## 9. MindSpace Behavior

- Continue using authenticated `GET /api/v1/mindspaces` and the current response contract.
- On shell initialization, read the existing selected MindSpace ID from `sessionStorage` only after the owned MindSpaces load.
- Accept the restored ID only when it exists in the returned list. Otherwise select the first returned MindSpace, persist that fallback, and expose it to the active child route.
- Persist every explicit selection change using the existing storage helper.
- Preserve the current first-MindSpace and additional-MindSpace `CreateMindSpace` flows. A successful creation is inserted into the shell's available list, becomes selected, is persisted, and unlocks active feature content.
- Only `AppShell` owns the in-memory MindSpace list and selected ID. Route pages and feature components must not fetch MindSpaces or establish competing selected-ID state.
- Changing MindSpace updates the active feature's `mindSpaceId`. Existing feature reset, reload, stale-request, and error behavior must remain in effect.
- Navigating among sibling section routes must not trigger a second shell-level MindSpace fetch solely because the route changed. A full browser refresh initializes the shell again and restores the persisted valid selection.

## 10. Chat Layout And Scrolling Contract

### Desktop Structure

```text
Workspace viewport
├── Workspace Sidebar
└── Workspace column
    ├── Header
    └── Main Content
        └── Chat area
            ├── Conversation pane
            │   ├── heading/create controls
            │   └── independently scrollable conversation list
            └── Message pane
                ├── conversation heading
                ├── independently scrollable message-state/list region
                └── composer
```

- The protected workspace establishes a bounded block-size chain from the viewport through shell, workspace column, Main Content, Chat, and both Chat panes.
- Every intermediate grid/flex item that must shrink supplies the equivalent of `min-height: 0`/`min-block-size: 0` and `min-width: 0`/`min-inline-size: 0` as needed. Adding overflow only to an otherwise unbounded message list is not acceptable.
- Chat's new UI should be built primarily with Tailwind and shadcn/ui primitives for the conversation sidebar/panel, message pane, message states, controls, composer, responsive mobile Sheet/panel, and accessible buttons/forms. shadcn abstractions must not obscure or weaken the bounded height chain, shrink behavior, overflow ownership, composer placement, or scroll measurements.
- The shell targets the usable viewport using dynamic viewport sizing where available with a safe viewport fallback. Normal Chat use must not increase document height as histories grow.
- The Header and Sidebar remain accessible within the shell. The message pane reserves space for its heading and composer; only the message region owns message-history vertical scrolling.
- The conversation pane reserves space for creation controls and gives its list region independent vertical overflow. A long list must not lengthen the message pane or document.
- Composer resizing must remain bounded so it cannot displace the message list or escape the viewport. Existing compose, validation, disabled, sending, and error behavior remains unchanged.

### Scrolling Rules

1. **Opening a conversation**: Clear the previous message context, show loading, and, after the selected conversation's initial messages render, scroll that message region to its bottom once. This applies even if the previously open conversation had been scrolled upward because the conversation context changed.
2. **Receiving/loading messages in the same conversation**: Before replacing or appending rendered messages, determine whether the user is near the bottom. "Near bottom" means the remaining scroll distance is no more than 80 CSS pixels. If near bottom, keep the view pinned to the new bottom after render. If farther than 80 pixels, preserve the user's reading position and do not force a jump.
3. **Sending a new message**: Capture the near-bottom state at submission. After the existing send-and-refresh flow completes, scroll to the new bottom only if the user was near bottom at submission or returned near bottom before the refreshed messages rendered. Otherwise preserve the user's upward reading position. Clearing the composer and send-state/error behavior remain as currently defined.
4. **Manual upward scrolling**: Crossing beyond the 80-pixel threshold marks the user as reading history. Same-conversation renders and send refreshes must not override that intent. Returning within the threshold restores automatic bottom pinning for subsequent same-conversation updates.
5. **Switching conversations**: Reset the previous conversation's scroll intent and position. The newly selected conversation follows the initial-open rule and scrolls to its own bottom after successful loading. A stale prior response cannot change either scroll position or messages.
6. **Switching MindSpaces**: Clear active conversation, messages, composer content, send errors, pending flags, and scroll intent before loading the new conversation list. No old-MindSpace scroll position or request continuation survives into the new context.

### Preserved Chat Behavior

- Preserve list/create/open/load/send request contracts and current loading, empty, validation, success, and safe error outcomes.
- Preserve locale-aware authentication redirection, 404 active-conversation reset, and request-identity protections for MindSpace and conversation changes.
- Add unmount cleanup to the MindSpace-driven Chat effect so all Chat request identities are invalidated when route navigation unmounts Chat. Late promise continuations must become no-ops and must not perform state updates or affect a newer mounted context.
- T034 does not add streaming, optimistic message records, pagination, search, unread indicators, or conversation persistence in the URL.

## 11. Documents/Tasks/Notes Migration

- `frontend/components/documents.tsx` moves behind `/{locale}/app/documents` without changing its existing list/upload API behavior, PDF validation, loading state, success/error feedback, or `PROCESSING`, `READY`, and `FAILED` status presentation.
- Documents does not gain delete, preview, download, polling, status refresh, or broader document management. Its section content may scroll within Main Content as a normal feature page; Chat's pane-specific containment must not be imposed on it.
- `frontend/components/tasks.tsx` moves behind `/{locale}/app/tasks` and retains current list, create, request guards, states, payloads, ordering, and MindSpace-change behavior. No Tasks capability is added.
- `frontend/components/notes.tsx` moves behind `/{locale}/app/notes` and retains current list, create, select/read, request guards, states, and MindSpace-change behavior. No Notes capability is added.
- Documents, Tasks, and Notes do not need a full Tailwind/shadcn migration in T034. They may continue using existing global CSS, with only minimal wrapper or spacing changes allowed when necessary for correct rendering inside the new workspace shell.
- Each route mounts one existing feature with the shared selected MindSpace ID. Navigating away unmounts that feature; returning creates a fresh feature-local state and reloads according to existing behavior.

## 12. Memories Placeholder Behavior

- `/{locale}/app/memories` is a real protected workspace route and a normal Sidebar destination.
- It renders a minimal translated "Coming Soon" state consistent with existing cream-card and rounded-surface styling.
- The placeholder may use Tailwind and small shadcn primitives when this is simpler than adding legacy CSS, but it remains non-functional.
- The placeholder performs no data request, exposes no create/edit/delete controls, and does not imply that memory records currently exist.
- The route still participates in shell authentication, MindSpace presentation, locale preservation, active navigation, responsive behavior, and direct refresh.

## 13. Responsive Behavior

### Desktop

- At the established desktop breakpoint, the workspace Sidebar and Header remain persistent and the shell is bounded to the usable viewport.
- Main Content receives the remaining inline and block space and permits each active feature to choose appropriate internal scrolling.
- Chat uses side-by-side conversation and message panes with independent overflow as defined in Section 10.
- Tailwind layout utilities may implement the viewport grid/flex chain, but tests must verify the resulting computed behavior rather than assume utility names are sufficient.
- Documents, Tasks, Notes, and Memories may use Main Content scrolling rather than Chat's internal message scrolling contract.

### Mobile

- Workspace navigation becomes the temporary shell-level shadcn Sheet/drawer defined in Section 7 and does not permanently consume viewport width.
- The Header remains usable with a menu control, current section identity, and access to MindSpace/account actions without horizontal overflow.
- Chat conversation navigation becomes a separate Chat-local shadcn Sheet/panel rather than a full conversation list stacked above the message pane.
- If no conversation is active on initial mobile Chat entry, the conversation panel may open initially to support selection. After a conversation is selected, it closes and focus moves to the conversation heading or message region. The user can reopen it with a clearly labeled Chat control.
- The Chat conversation panel has its own bounded list overflow and can be dismissed with its close control or Escape. It must not open, close, or navigate the workspace Sidebar.
- The message pane consumes the remaining mobile Chat height; its message list scrolls and its composer stays accessible above the viewport edge and safe-area inset.
- Controls maintain touch-friendly targets, content does not create horizontal viewport overflow, and long strings wrap safely.

## 14. i18n/RTL Requirements

- Preserve `next-intl`, locale-prefixed routing, the existing locale provider, `en` and `ar`, and the current `<html dir="rtl">` behavior from `frontend/app/[locale]/layout.tsx`.
- Add matching English and Arabic strings for workspace navigation labels, navigation landmark, mobile menu open/close labels, section headings as needed, user/account presentation, Chat conversation-panel controls, and Memories placeholder text.
- Do not create component-level direction state. Components inherit document direction and use logical CSS properties for inline/block placement, spacing, borders, alignment, drawer anchoring, and transforms wherever practical.
- The persistent desktop Sidebar and temporary mobile workspace drawer occupy logical inline start. Chat's mobile conversation panel also respects logical direction but remains a separate layer and state model.
- Navigation preserves the current locale for every section, redirect, logout action, and authentication redirect.
- Arabic text and long translated labels must not overlap controls or cause horizontal viewport overflow.

### Styling And UI Migration Requirements

- T034 intentionally introduces Tailwind CSS and shadcn/ui as part of the approved workspace refactor scope.
- Tailwind is the primary styling approach for new T034 workspace shell and Chat UI, including layout, spacing, colors, responsive behavior, and state styling.
- shadcn/ui primitives should be used where they provide clear value for accessibility, keyboard interaction, composition, or consistency. Priority components are Sidebar composition where applicable, Sheet/drawer, Button, Select/dropdown controls, Avatar/email identity presentation, DropdownMenu/account actions, ScrollArea where it does not obscure scroll ownership, Tooltip where useful, and other small primitives justified during planning.
- Chat is the highest-priority Tailwind/shadcn migration target. Its bounded viewport layout, conversation sidebar/panel, message area, independently scrollable message history, composer, mobile conversation Sheet, loading/empty/error states, and accessible controls should use this new UI approach.
- The Chat scrolling contract remains authoritative over any shadcn abstraction. Implementers must be able to identify the actual scroll host, bounded ancestors, `min-height: 0`/shrink chain, composer row, and near-bottom measurement surface.
- Existing global CSS remains valid for legacy/existing feature UI. Do not delete working legacy CSS merely to achieve styling consistency.
- Existing Documents, Tasks, Notes, Login, Register, and onboarding UI are not required to migrate to Tailwind/shadcn in T034. Minimal integration changes are allowed only where needed to render correctly inside the new workspace shell.
- Preserve Priora's visual identity: warm background, cream/light surfaces, dark controls, rounded surfaces, restrained professional appearance, and existing typography/spacing intent.
- shadcn/ui must provide reusable primitives and accessibility behavior, not a visual rebrand. Its theme tokens must be configured to the existing Priora visual language.
- Do not add unrelated component libraries. Additional packages are limited to Tailwind CSS setup, shadcn/ui initialization, and dependencies required by the selected shadcn primitives.

## 15. State/Lifecycle Rules

### Shared State That Must Survive Sibling Navigation

- Authentication remains backed by the existing session storage and protected by the existing `AuthGate` behavior.
- The MindSpace list, selected MindSpace ID, selection persistence, MindSpace loading/error status, and create-MindSpace visibility remain shell-owned at `frontend/app/[locale]/app/layout.tsx` through `AppShell`.
- The shell layout must remain mounted during normal navigation among `/chat`, `/documents`, `/tasks`, `/notes`, and `/memories`, preserving its in-memory state.

### Feature-Local State That May Reset

- Chat conversation list, active conversation, messages, drafts, send/create states, errors, request IDs, panel state, and scroll intent remain local to Chat.
- Documents list/upload state remains local to Documents; Tasks list/form state remains local to Tasks; Notes list/selection/form state remains local to Notes.
- Real route navigation unmounts the previous feature. T034 makes no promise that drafts, active records, scroll positions, success messages, or feature data survive leaving and later returning to a section.
- Returning to a feature remounts it and runs its existing current-MindSpace loading behavior. This is intentional and must be covered by regression expectations rather than hidden by a new global cache.
- A MindSpace change while a feature is mounted keeps the route but triggers that feature's existing reset and reload contract.
- Every feature with asynchronous work must reject stale continuations after MindSpace changes and unmount. Chat's missing unmount invalidation is specifically corrected; unrelated feature logic is not rewritten.
- No Redux, Zustand, query/cache library, or other global state dependency is introduced.

## 16. Accessibility Requirements

- Use a semantic navigation landmark for workspace links and a distinct Main Content landmark for the active feature.
- Expose active section links with both visible styling and `aria-current="page"`; do not rely on color alone.
- The mobile workspace-menu button and Chat conversation-panel button have translated accessible names, visible focus, `aria-expanded`, and `aria-controls` referencing their respective panels.
- Temporary drawers/panels provide an accessible close control, close on Escape, contain focus while modal, prevent interaction with obscured content, and restore focus to the opener when dismissed. After route activation, focus moves predictably to the new section heading/Main Content rather than back into a removed drawer.
- All navigation links, selectors, account/logout actions, conversation controls, composer controls, and existing feature forms remain keyboard operable.
- Existing form labels, error alerts, loading announcements, and live regions are preserved. New status or placeholder text uses appropriate semantics without excessive announcements.
- Visible focus indicators must be available against warm and cream surfaces for links, buttons, inputs, textareas, and selects.
- T034 does not expand into a full accessibility redesign or require unrelated component remediation.

## 17. Testing Strategy

Use the existing Playwright configuration in `frontend/playwright.config.ts`. Add focused route/shell/Chat regression tests and adjust only existing assertions affected by the `/{locale}/app` redirect. Reuse API interception patterns from `frontend/tests/onboarding.spec.ts`; do not rewrite unrelated tests.

### Required Automated Scenarios

1. `/{locale}/app` redirects to `/{locale}/app/chat` and uses replacement semantics suitable for normal back navigation.
2. Sidebar links navigate to all five sections, only the active feature renders, and browser back/forward updates content and active indication.
3. Every section link and redirect preserves `en` or `ar`; direct refresh at every child route remains in that section for an authenticated session.
4. The active navigation link is visually identifiable and has `aria-current="page"` after link navigation, refresh, and history navigation.
5. Selecting a MindSpace, moving across at least three sections, and returning to Chat preserves the shell selection and stored ID without duplicate shell ownership.
6. Logout from a child route clears auth and MindSpace storage and reaches the same-locale login page.
7. Empty-MindSpace onboarding, failed creation/retry, successful creation, selection persistence, and subsequent Chat availability continue to work after the redirect.
8. At a representative desktop viewport with long mocked messages, workspace/document height stays within a small rendering tolerance of the viewport, the message region has vertical overflow, and the composer and header remain visible.
9. A long conversation list scrolls independently from the message region and does not move the composer.
10. Opening and switching conversations initially lands at the bottom; same-conversation updates auto-scroll when within 80 pixels of bottom and preserve position when farther away.
11. Switching MindSpaces clears active Chat context and ignores delayed prior-MindSpace responses; leaving Chat invalidates delayed Chat responses without console errors or cross-route UI changes.
12. At a representative mobile viewport, the workspace drawer opens/closes with correct expanded state, closes after navigation/Escape, and does not permanently consume width.
13. Mobile Chat's conversation panel operates independently from the workspace drawer, closes after selection, and leaves the message list and composer usable with long data.
14. Arabic routes set RTL, place workspace navigation at logical inline start, retain Arabic destinations, show translated labels, and avoid horizontal overflow.
15. Existing Documents PDF upload/status behavior, Tasks behavior, and Notes behavior receive the currently selected MindSpace on their routes without scope expansion.

### Additional Verification

- Run existing frontend type checking and production build after implementation.
- Run the focused Playwright suite plus unchanged onboarding coverage.
- Manually inspect desktop and mobile EN/AR layouts for focus order, drawer layering, safe-area/composer access, long strings, and no horizontal overflow.
- Verify Login and Register remain normal scrolling document pages and are unaffected by workspace containment.

## 18. Files To Create

- `frontend/app/[locale]/app/layout.tsx` — shared protected workspace layout/state boundary composing `AuthGate` and refactored `AppShell`.
- `frontend/app/[locale]/app/chat/page.tsx` — thin Chat route using the shared selected MindSpace.
- `frontend/app/[locale]/app/documents/page.tsx` — thin Documents route using the shared selected MindSpace.
- `frontend/app/[locale]/app/tasks/page.tsx` — thin Tasks route using the shared selected MindSpace.
- `frontend/app/[locale]/app/notes/page.tsx` — thin Notes route using the shared selected MindSpace.
- `frontend/app/[locale]/app/memories/page.tsx` — translated non-functional Memories placeholder route.
- `frontend/components/workspace-sidebar.tsx` — desktop navigation and mobile workspace drawer.
- `frontend/components/workspace-header.tsx` — section title, MindSpace presentation/selector, authenticated email identity, mobile menu, and logout/account action.
- `frontend/components/ui/button.tsx` — shadcn Button primitive used by workspace and Chat controls.
- `frontend/components/ui/sheet.tsx` — shadcn Sheet primitive for mobile workspace and Chat panels.
- `frontend/components/ui/select.tsx` or `frontend/components/ui/dropdown-menu.tsx` — shadcn selection/account controls as chosen during planning.
- `frontend/components/ui/avatar.tsx` — shadcn Avatar-style email identity presentation without backend profile assumptions.
- `frontend/components/ui/scroll-area.tsx` — shadcn ScrollArea only where it preserves explicit scroll-host ownership and testability.
- `frontend/components/ui/tooltip.tsx` — shadcn Tooltip for compact controls where useful and accessible.
- `frontend/lib/utils.ts` — class-name utility required by shadcn/ui.
- `frontend/components.json` — shadcn/ui project configuration for the existing App Router frontend.
- Tailwind/PostCSS configuration files required by the selected Next.js 16 Tailwind setup, expected under `frontend/`.
- `frontend/tests/workspace.spec.ts` — focused route, shell, responsive, RTL, state-continuity, and Chat containment regressions.

No Memories API module, backend file, profile module, global store, unrelated component library, or icon package is created unless planning explicitly justifies a minimal icon dependency for shadcn primitives. Text labels and CSS-only marks remain preferred.

## 19. Files To Modify

- `frontend/app/[locale]/app/page.tsx` — replace the current mounted shell page with the locale-preserving redirect to Chat.
- `frontend/package.json` and frontend lockfile — add only the Tailwind CSS, shadcn/ui initialization, and selected shadcn primitive dependencies required for T034.
- `frontend/tsconfig.json` — update path aliases only if required by shadcn/ui initialization and without disrupting existing imports.
- `frontend/components/app-shell.tsx` — refactor the existing shell into the shared layout content/state owner, remove simultaneous feature mounting, expose selected MindSpace context to the active child route, and retain auth-adjacent MindSpace/onboarding/logout behavior.
- `frontend/components/chat.tsx` — establish bounded pane regions and mobile conversation controls, implement the scrolling contract, and add unmount request invalidation while preserving current API behavior.
- `frontend/app/globals.css` — add Tailwind entry/import directives and any small shared CSS variables or legacy compatibility rules required by shadcn/Tailwind; preserve existing global CSS for legacy screens and avoid global public-page overflow changes.
- `frontend/messages/en.json` — add English workspace navigation/header/drawer/Chat-panel/Memories strings.
- `frontend/messages/ar.json` — add matching Arabic strings.
- `frontend/tests/onboarding.spec.ts` — update only route expectations or selectors made obsolete by the `/{locale}/app` redirect/shared shell while preserving existing onboarding scenarios.
- `.specify/feature.json` — point downstream specification commands to `specs/007-workspace-navigation-refactor`.

Expected unchanged production files include `frontend/components/documents.tsx`, `frontend/components/tasks.tsx`, `frontend/components/notes.tsx`, existing API modules under `frontend/lib/api/`, `frontend/lib/auth-state.ts`, `frontend/lib/mindspace-selection.ts`, `frontend/i18n/routing.ts`, and public Login/Register pages unless implementation proves a minimal integration-only adjustment is necessary. Any such adjustment requires explicit scope justification during planning. These existing feature components do not need full Tailwind/shadcn migration in T034.

## 20. Migration/Implementation Sequence

1. **Tailwind and shadcn foundation**: Install/configure Tailwind CSS for the existing Next.js 16 frontend, initialize shadcn/ui for the App Router structure, configure Priora theme tokens, add required shadcn utility/config files, and confirm legacy global CSS still applies to existing public and feature screens.
2. **Route skeleton and redirect**: Add the shared workspace layout and five child pages; change `frontend/app/[locale]/app/page.tsx` to redirect to locale Chat. Initially keep route pages thin and verify direct navigation, refresh, and locale behavior.
3. **Shared shell boundary**: Refactor `AppShell` to accept active child content, retain the single MindSpace owner, and expose validated selection through the smallest local context. Move `AuthGate` composition to the shared layout and verify loading, error, onboarding, fallback selection, persistence, and logout before changing feature internals.
4. **Desktop navigation and Header with shadcn primitives**: Add `WorkspaceSidebar` and `WorkspaceHeader`, route links, active-state derivation, section titles, authenticated email identity, selector/create actions, translated EN/AR strings, and shadcn Button/Select/DropdownMenu/Avatar/Tooltip primitives where justified. Verify only one route feature mounts.
5. **Feature route migration**: Wire Documents, Tasks, and Notes pages to shared `mindSpaceId` without changing their components or API modules. Add the non-functional Memories placeholder. Run feature regressions and verify feature-local state resets on route unmount are intentional.
6. **Workspace containment foundation**: Add workspace-scoped Tailwind viewport/grid/flex shrink classes and any required small CSS variables/compatibility rules for Main Content overflow, desktop Sidebar/Header, and logical-direction behavior. Confirm public pages retain normal document flow before applying Chat-specific overflow.
7. **Desktop Chat containment with Tailwind/shadcn UI**: Refactor Chat markup/styles so conversation and message regions have bounded independent overflow and the composer remains fixed within the message pane. Use shadcn primitives only where the concrete scroll hosts and bounded height chain remain explicit. Add Chat effect unmount cleanup and verify all existing request, 404, unauthorized, and stale-response behavior.
8. **Chat scroll behavior**: Implement initial bottom positioning, the 80-pixel near-bottom rule, reading-position preservation, and resets for conversation/MindSpace changes. Add deterministic long-history Playwright coverage.
9. **Mobile workspace navigation**: Add the shadcn Sheet-based workspace drawer, focus handling, backdrop/Escape/route-close behavior, touch sizing, and RTL placement. Verify it remains independent of Chat state.
10. **Mobile Chat conversation navigation**: Replace vertical conversation stacking with a Chat-local shadcn Sheet/panel, define initial no-selection behavior, close/focus behavior after selection, and preserve message/composer viewport access.
11. **Regression and cleanup**: Update affected onboarding assertions, run typecheck/build/Playwright, test direct child refresh and history, inspect EN/AR desktop/mobile, and confirm no backend, API-contract, unrelated dependency, full legacy migration, or out-of-scope feature changes entered the diff.

Each phase must leave the application testable. Tailwind/shadcn setup precedes new workspace UI; route and shell behavior precede visual containment; desktop Chat containment precedes mobile overlays; no phase should rewrite working legacy feature internals merely to match the new UI approach.

## 21. Acceptance Criteria

### Functional Requirements

- **FR-001**: The protected workspace MUST expose real locale-prefixed routes for Chat, Documents, Tasks, Notes, and Memories.
- **FR-002**: `/{locale}/app` MUST redirect to `/{locale}/app/chat` while preserving locale.
- **FR-003**: Refresh, direct navigation, and browser back/forward MUST render the correct active child section and navigation state.
- **FR-004**: The shared workspace layout MUST retain the existing authentication boundary and MUST render only the active route's feature content.
- **FR-005**: `AppShell` MUST remain the single owner of MindSpace loading, validation, fallback, selection, persistence, and onboarding state.
- **FR-006**: Sibling section navigation MUST preserve valid MindSpace context and MUST NOT create per-page MindSpace ownership.
- **FR-007**: The Sidebar MUST provide locale-aware links for all five sections and a visible, programmatically exposed active state.
- **FR-008**: Desktop workspace navigation and Header MUST remain persistently accessible within a bounded workspace.
- **FR-009**: Mobile workspace navigation MUST be a temporary, dismissible, keyboard-accessible drawer at logical inline start.
- **FR-010**: The Header MUST show the active section, current MindSpace controls, authenticated email identity, and existing logout action without fabricated names or avatars.
- **FR-011**: No-MindSpace onboarding, additional MindSpace creation, invalid stored-selection fallback, and selection persistence MUST retain current behavior.
- **FR-012**: Desktop Chat MUST fit the usable workspace viewport during normal use and MUST NOT grow document height with conversation or message count.
- **FR-013**: Chat message history MUST own message scrolling, its composer MUST remain accessible, and long conversation lists MUST scroll independently.
- **FR-014**: Chat MUST follow the six scrolling rules in Section 10, including the testable 80-pixel near-bottom threshold and protection of deliberate upward reading.
- **FR-015**: Chat MUST preserve conversation loading/creation/selection, message loading/sending, safe errors, auth redirects, stale-request protection, and 404 behavior.
- **FR-016**: Chat MUST invalidate all request identities when route navigation unmounts it.
- **FR-017**: Mobile Chat conversation navigation MUST remain usable without stacking a long conversation list above the message pane and MUST remain independent from workspace navigation.
- **FR-018**: Documents MUST retain current PDF upload, validation, states, feedback, listing, and status behavior on its route without expanded management.
- **FR-019**: Tasks and Notes MUST retain current functionality on their routes without feature expansion.
- **FR-020**: Memories MUST render only a translated non-functional placeholder and MUST perform no Memories data operation.
- **FR-021**: New and existing affected workspace text MUST be available in English and Arabic and inherit the existing document direction.
- **FR-022**: Workspace and Chat layout MUST avoid horizontal overflow and use direction-safe placement in LTR and RTL.
- **FR-023**: Public Login and Register pages MUST remain normal document pages and MUST NOT inherit workspace viewport overflow containment.
- **FR-024**: Authentication and MindSpace state MUST remain shared; feature data, drafts, selections, request state, drawer/panel state, and scroll state MAY remain feature-local and reset on route unmount as specified.
- **FR-025**: Existing backend contracts and API modules MUST be reused; T034 MUST NOT require backend or profile capabilities.
- **FR-026**: Frontend requests MUST continue to target only existing NestJS endpoints and MUST NOT directly access Agent, RAG, Qdrant, PostgreSQL, Supabase, or storage services.
- **FR-027**: Semantic navigation, active indication, keyboard operation, translated accessible labels, focus containment/restoration, visible focus, and appropriate ARIA state MUST satisfy Section 16.
- **FR-028**: Focused Playwright coverage MUST include every scenario listed in Section 17 without rewriting unrelated tests.
- **FR-029**: T034 MUST NOT require a full Tailwind/shadcn migration of Documents, Tasks, Notes, Login, Register, or onboarding; existing global CSS for those screens MUST remain valid during the controlled migration.
- **FR-030**: Dependencies added for T034 MUST be limited to Tailwind CSS setup, shadcn/ui initialization, and selected shadcn primitive dependencies required by the approved workspace and Chat UI.
- **FR-031**: The new workspace Sidebar, Header, mobile navigation, Memories placeholder, and Chat UI MUST use Tailwind CSS as their primary styling approach and shadcn/ui primitives where those primitives provide clear current value.
- **FR-032**: Chat's Tailwind/shadcn implementation MUST keep the actual scroll host, bounded ancestor chain, overflow ownership, composer placement, and 80-pixel near-bottom measurement explicit and testable.

### API Boundary

- **NestJS Endpoints Used**: Existing authenticated `GET /api/v1/mindspaces`, `POST /api/v1/mindspaces`, `GET/POST /api/v1/conversations`, `GET/POST /api/v1/conversations/{conversationId}/messages`, `GET/POST /api/v1/documents`, `GET/POST /api/v1/tasks`, `GET/POST /api/v1/notes`, and `GET /api/v1/notes/{noteId}` exactly as already consumed by frontend modules. T034 introduces no endpoint.
- **Authentication Context**: Existing bearer authentication from session-stored auth state is reused. The frontend does not send `userId`; backend authentication and ownership remain authoritative.
- **Excluded Direct Access**: Frontend does not directly access Agent, RAG, Qdrant, PostgreSQL, Supabase, storage services, or any new profile or Memories service.

### Key Entities

- **Workspace Section**: One of Chat, Documents, Tasks, Notes, or Memories, represented by a locale-prefixed route, translated label, active-navigation state, and section title.
- **Authenticated Identity**: Existing session data containing access token and user ID/email; only email and an optional email-derived initial are displayable in T034.
- **MindSpace Context**: The shell-owned list of available MindSpaces and one validated selected ID supplied to the active feature.
- **Workspace Navigation State**: Current route plus mobile drawer visibility; independent from Chat conversation selection.
- **Chat Conversation Context**: Chat-local conversation list, active conversation, messages, drafts, request identities, mobile panel state, and scroll intent for one selected MindSpace.

### Measurable Outcomes

- **SC-001**: In automated coverage, 100% of the six workspace entry URLs (`/app` plus five child routes for each tested locale) reach the expected localized section or redirect outcome after direct navigation and refresh.
- **SC-002**: In route-navigation tests, all five section links preserve locale, show exactly one active indication, and render no non-active feature section.
- **SC-003**: A selected valid MindSpace remains unchanged through navigation across all five sections and is restored after one full refresh in 100% of tested flows.
- **SC-004**: With at least 100 mocked messages and 50 mocked conversations at a representative desktop viewport, the header and composer remain visible, message and conversation regions independently overflow, and document height stays within 2 CSS pixels of the viewport height after rendering and sending.
- **SC-005**: Automated scroll tests demonstrate bottom positioning on initial/switch loads, automatic bottom retention at 80 pixels or less, and no forced bottom jump beyond 80 pixels in 100% of tested updates.
- **SC-006**: At a 390 by 844 viewport, users can reach a conversation and enabled composer without scrolling past the conversation list; workspace and Chat panels operate independently and document width does not exceed viewport width.
- **SC-007**: Keyboard-only checks can open, traverse, close, and restore focus for both mobile panels, activate every workspace route, change MindSpace, and log out without a pointer.
- **SC-008**: English/LTR and Arabic/RTL automated checks pass the same route, active-state, drawer-placement, and no-horizontal-overflow scenarios.
- **SC-009**: All pre-existing onboarding scenarios and focused Documents, Tasks, Notes, Chat, logout, unauthorized, stale-response, and 404 regressions pass without backend changes.
- **SC-010**: Tailwind CSS and shadcn/ui are installed/configured successfully, new workspace and Chat UI use them as specified, and existing legacy-styled screens continue to render correctly.
- **SC-011**: The implementation adds zero backend endpoints, zero profile fields, zero Memories data operations, zero unrelated component libraries, and zero unapproved runtime dependencies beyond the approved Tailwind/shadcn set.

## 22. Explicit Non-Goals

- Backend changes or unrelated API refactors.
- Authentication redesign, new auth framework, or changed token persistence.
- Profile API, first/full names, avatars, account settings, or fabricated identity data.
- Memories API module, list, creation, editing, deletion, search, or any CRUD behavior.
- New Tasks or Notes functionality.
- Document delete, preview, download, polling, or expanded document management.
- Streaming Chat, optimistic message models, conversation search, rename/archive/delete, pagination, attachments, citations, voice, or new Agent behavior.
- Persisting feature-local drafts, active records, scroll positions, or loaded feature data across route unmounts.
- A full frontend redesign, design-system migration beyond the controlled Tailwind/shadcn workspace and Chat scope, visual rebrand, theme system, or notifications.
- Full Tailwind/shadcn migration of Documents, Tasks, Notes, Login, Register, onboarding, or other legacy UI in T034.
- Unrelated component libraries or icon libraries without a planning-time justification tied directly to required shadcn primitives or accessible workspace/Chat controls.
- Global body overflow containment affecting public pages.
- Global application-state or server-cache library adoption.
- A full accessibility redesign beyond the focused requirements in this specification.

## 23. Risks And Mitigations

- **Risk: Persistent layout and client-only auth initialization can briefly render incomplete shell state.** Mitigation: keep `AuthGate` and shell loading gates ahead of feature rendering; direct child routes do not mount features until auth and a valid MindSpace are available.
- **Risk: Route pages accidentally become new MindSpace owners.** Mitigation: expose one shell context, keep child pages thin, and test one selection across multiple sibling routes and refresh.
- **Risk: Viewport overflow is applied globally and breaks public pages.** Mitigation: scope containment selectors to the protected workspace root and explicitly test Login/Register document scrolling.
- **Risk: An unbounded ancestor defeats message-list overflow.** Mitigation: verify the complete block-size and shrink chain, inspect computed overflow, and assert document versus viewport height with long fixtures.
- **Risk: Mobile workspace and conversation drawers conflict.** Mitigation: keep components, state, controls, IDs, and focus restoration separate; test both in one scenario. The implementation may close one overlay before opening the other only as a presentation safety rule, but it must not merge their navigation/selection state.
- **Risk: Automatic scrolling interrupts history reading.** Mitigation: use the specified 80-pixel threshold, capture intent before updates, reset only on context changes, and test both sides of the threshold.
- **Risk: Late Chat promises update after route unmount.** Mitigation: invalidate all Chat request counters in effect cleanup and retain current context checks around every continuation.
- **Risk: Real route navigation resets useful local state.** Mitigation: state reset is documented and accepted for feature-local data; only auth and MindSpace continuity are required. No hidden caching scope is introduced.
- **Risk: Existing onboarding tests assume `/app` renders without redirect.** Mitigation: update only impacted URL/selector expectations and retain all existing behavioral assertions.
- **Risk: Header controls crowd narrow or translated layouts.** Mitigation: define wrapping/condensed presentation, logical sizing, long-text handling, and mobile EN/AR checks without removing accessible identity or actions.
- **Risk: CSS refactor changes feature behavior or visual language.** Mitigation: preserve feature components and API modules, introduce workspace-scoped styles incrementally, and compare existing states in each route.
- **Risk: Tailwind/shadcn setup expands into an unbounded design-system migration.** Mitigation: scope Tailwind/shadcn to new T034 workspace and Chat UI, keep legacy CSS for existing screens, and treat any broader migration as out of scope.
- **Risk: shadcn abstractions hide the element that actually scrolls in Chat.** Mitigation: require explicit scroll-host refs/selectors, verify computed overflow and geometry, and reject any primitive usage that obscures the authoritative height/overflow contract.
- **Risk: default shadcn styling rebrands the product.** Mitigation: configure tokens and Tailwind classes to Priora's warm/cream/dark/rounded identity and review EN/AR desktop/mobile visuals.
- **Risk: dependency drift from shadcn initialization adds unrelated libraries.** Mitigation: document every new dependency in planning, add only packages required by Tailwind/shadcn primitives selected for T034, and exclude unrelated component/icon libraries unless explicitly justified.

### Assumptions And Dependencies

- Existing authentication storage, `AuthGate`, MindSpace API/storage helpers, feature API modules, and Next.js locale routing remain available and authoritative.
- The frontend may temporarily use both existing global CSS for legacy UI and Tailwind/shadcn for new workspace and Chat UI.
- Tailwind CSS and shadcn/ui setup for the current Next.js 16 App Router frontend will be selected during planning using current compatible installation guidance.
- The first MindSpace returned by the existing API remains the accepted fallback when no valid stored selection exists.
- The existing locale layout remains the sole source of document direction.
- Session storage is intentionally scoped to the browser tab/session; cross-device or cross-session synchronization is not required.
- A mobile breakpoint consistent with current project conventions may be refined during planning, but required behavior is determined by available space rather than a device name.
- Browser support includes dynamic viewport units where available with an ordinary viewport-height fallback.
- There is no requirement to preserve a Chat active conversation or unsent draft after leaving Chat because neither is represented in the approved route architecture.

## T034 Definition of Done

T034 is complete when Tailwind CSS and shadcn/ui are installed and configured for the existing frontend; the five locale-prefixed workspace sections run under one protected persistent `AppShell`; `/app` redirects to Chat; auth, logout, onboarding, and one shared persisted MindSpace behave as before; only the active route feature renders; the new workspace shell and Chat UI use Tailwind/shadcn while preserving Priora's visual identity; desktop and mobile navigation are accessible and RTL-safe; Chat has a bounded viewport with independently scrolling conversations/messages, an always-accessible composer, precise non-disruptive bottom-scroll behavior, and unmount-safe requests; Documents, Tasks, Notes, Login, Register, and onboarding may remain legacy-styled and retain existing scope; Memories is placeholder-only; public pages remain normally scrollable; EN/AR strings are complete; and the focused Playwright, typecheck, and build regressions pass without backend changes or unrelated dependencies.
