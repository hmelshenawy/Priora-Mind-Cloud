# Research: T034 Workspace Shell, Navigation & Chat UX Refactor

## Persistent Workspace Boundary

**Decision**: Keep `frontend/app/[locale]/app/layout.tsx` as a Server Component that composes the existing client `AuthGate` and the refactored client `AppShell` around route children.

**Rationale**: App Router layouts persist during sibling navigation, preserving the authenticated shell and MindSpace state. The layout itself needs no browser API or hook, so keeping it server-rendered limits the client boundary. Authentication and MindSpace logic remain client-side because current state is in `sessionStorage`.

**Alternatives considered**:

- Client layout: works but moves an unnecessary boundary into the client bundle.
- Per-page `AuthGate`/`AppShell`: remounts and refetches shell state on every section navigation.
- Server authentication: impossible without redesigning the current session-storage token model and is outside scope.

## Locale Root Redirect

**Decision**: Make `frontend/app/[locale]/app/page.tsx` an async Server Component, await `params: Promise<{locale: string}>`, and call the framework redirect for `/${locale}/app/chat`.

**Rationale**: Next.js 16 dynamic params are asynchronous. A server redirect avoids hydration delay, preserves the locale validated by the parent layout, and uses replace-style navigation for this render-time redirect.

**Alternatives considered**:

- Client `router.replace` effect: adds a transient render and hydration dependency.
- Unprefixed redirect: breaks locale preservation.
- Local tab selection: fails direct URL, refresh, and history requirements.

## Tailwind CSS Setup

**Decision**: Install and configure Tailwind CSS using the current compatible setup for the existing Next.js 16 frontend. Add Tailwind entry/directives and required configuration without deleting existing global CSS.

**Rationale**: The approved T034 architecture explicitly requires Tailwind as the primary styling approach for new workspace and Chat UI. Keeping legacy CSS avoids an unnecessary migration of existing Documents, Tasks, Notes, Login, Register, and onboarding screens.

**Alternatives considered**:

- Continue global CSS only: rejected because it conflicts with the updated specification.
- Full CSS migration: rejected because it is explicitly out of scope and increases regression risk.
- Inline styles/CSS modules: rejected because the approved decision is Tailwind for new T034 UI.

## shadcn/ui Setup And Primitive Selection

**Decision**: Initialize shadcn/ui for the App Router structure and add only primitives required by T034: Sheet, Button, Select, DropdownMenu, Avatar, Tooltip, and ScrollArea only where it does not interfere with scroll measurement.

**Rationale**: shadcn/ui provides accessible, composable primitives while allowing Tailwind-based visual customization. Selective use prevents an uncontrolled design-system migration.

**Alternatives considered**:

- Native `<dialog>` drawers: rejected because the updated architecture decision prefers shadcn Sheet unless a concrete incompatibility appears.
- Custom focus-trapped overlays: more code and less value than approved shadcn Sheet.
- Use shadcn for every element: rejected because it obscures ownership and adds unnecessary complexity.
- Add unrelated component library: rejected as outside scope.

## Visual Identity And Theme

**Decision**: Configure Tailwind/shadcn tokens and classes to preserve Priora's warm background, cream/light surfaces, dark restrained controls, rounded surfaces, soft borders, and professional spacing.

**Rationale**: shadcn should provide primitives and accessibility behavior, not a visual rebrand. Visual continuity reduces regression risk and keeps the refactor focused on workspace architecture and Chat usability.

**Alternatives considered**:

- Accept shadcn defaults unchanged: rejected because defaults may conflict with existing Priora visual language.
- Introduce a theme system: rejected as out of scope.

## Shared MindSpace State

**Decision**: Keep all MindSpace list/status/selection/actions in `AppShell` and add one minimal context module exposing only the validated non-null selected ID to route adapters.

**Rationale**: App Router children are opaque to the layout and cannot receive ordinary injected props. React context is already available, remains scoped to the protected subtree, and avoids global state. A separate focused module keeps provider/hook mechanics out of an already substantial shell.

**Alternatives considered**:

- Per-page MindSpace loading: duplicates ownership and produces synchronization races.
- URL/query MindSpace ID: changes approved routing and persistence semantics.
- Global state library: unnecessary dependency for one route subtree.
- Cloning route children: unsupported and tightly couples the layout to opaque route elements.

## Active Section Derivation

**Decision**: Use `useSelectedLayoutSegment()` with exact segment equality for Chat, Documents, Tasks, Notes, and Memories.

**Rationale**: It reads the immediate child below the workspace layout and updates for direct navigation, links, refresh hydration, and browser history without parsing locale-prefixed paths. The same value can drive Header title and `aria-current`.

**Alternatives considered**:

- `usePathname()` parsing: valid but adds locale/path normalization that the segment hook avoids.
- Local active state: can diverge from URL and browser history.
- Prefix matching: can falsely activate unknown or nested routes.

## Locale-Aware Links

**Decision**: Use existing `next/link` plus `useLocale()` and explicit absolute paths.

**Rationale**: The project has no centralized next-intl navigation wrapper. Five destinations do not justify adding another abstraction, and explicit paths are easy to audit.

**Alternatives considered**:

- Add `createNavigation(routing)`: useful at larger routing scale but not currently needed.
- Relative links: easier to misresolve and less explicit about locale preservation.

## Workspace Height And Overflow

**Decision**: Scope a complete bounded block-size chain to the protected workspace using Tailwind utilities and small CSS support only where required: `100vh` fallback followed by `100dvh`, shell and workspace-column grids with `minmax(0, 1fr)`, zero minimum block/inline sizes through Main and Chat descendants, and overflow only on designated scroll hosts.

**Rationale**: A child `overflow-y: auto` cannot scroll if any ancestor remains intrinsically unbounded. The complete chain lets Chat consume available height while public pages remain ordinary documents. Tailwind can express most sizing, grid, flex, overflow, and responsive behavior while preserving testable computed output.

**Alternatives considered**:

- Global body overflow lock: breaks Login/Register and can create restoration problems.
- Message-list overflow alone: does not constrain an unbounded ancestor.
- JavaScript `window.innerHeight` synchronization: unnecessary unless real-device keyboard testing proves CSS units insufficient.

## Chat Pane Structure

**Decision**: Build Chat with Tailwind and selected shadcn primitives, but preserve explicit pane grids with non-scrolling heading/control and composer rows plus `minmax(0, 1fr)` scroll rows. Keep one stable message scroll host mounted across all message states. Bound textarea growth and write `scrollTop` directly.

**Rationale**: Structural rows keep the composer accessible without overlaying messages. A stable native scroll host preserves refs and measurements while loading/error/empty/success content changes. Direct `scrollTop` avoids `scrollIntoView()` moving ancestor containers or the document.

**Alternatives considered**:

- Fixed/sticky composer: adds overlap, transformed-ancestor, and mobile-keyboard risks.
- One page-level Chat scrollbar: loses independent conversation/message behavior.
- Blind shadcn ScrollArea usage for messages: may hide the actual measured element and weaken the required scroll contract.
- `scrollIntoView()`: can scroll unintended ancestors.

## shadcn ScrollArea Use

**Decision**: Use shadcn ScrollArea only where it does not interfere with direct scroll-host measurement. Prefer a normal native overflow container for the message history unless the implementation can reliably expose the measured element.

**Rationale**: The Chat contract depends on exact `scrollTop`, `scrollHeight`, and `clientHeight`. Correct behavior and deterministic tests are more important than using a primitive.

**Alternatives considered**:

- ScrollArea everywhere: rejected because it can obscure measurement and ownership.
- Native overflow everywhere: acceptable fallback, but ScrollArea may still be useful for non-critical conversation lists if it remains testable.

## Automatic Message Scrolling

**Decision**: Define near bottom as `max(0, scrollHeight - clientHeight - scrollTop) <= 80`. Track intent and one pending post-render scroll plan in refs, measure before applying new messages, and perform accepted scroll writes in a layout effect.

**Rationale**: The threshold is precise and testable. Measuring before the list grows preserves the user's true intent; measuring only afterward would misclassify a previously pinned user. Refs avoid rendering on every scroll event.

**Alternatives considered**:

- Always scroll after messages: interrupts deliberate history reading.
- Never scroll automatically: makes active conversation and send results difficult to find.
- Bottom sentinel/IntersectionObserver: workable but more machinery than exact distance measurement.

## Chat Request Cleanup

**Decision**: On Chat MindSpace-effect cleanup, increment list, message, create, and send request identities. Retain expected MindSpace/conversation and current request checks on every continuation.

**Rationale**: Route navigation now regularly unmounts Chat. Identity invalidation makes late promises no-ops without introducing cancellation infrastructure and matches existing stale-request patterns.

**Alternatives considered**:

- AbortController retrofit across API modules: broader API refactor not required for correctness.
- Mounted boolean only: does not distinguish overlapping same-component conversation/MindSpace requests as clearly as existing identities.

## Mobile Panels And Focus

**Decision**: Use independent shadcn Sheet components for workspace navigation and Chat conversation navigation, with separate state, IDs, triggers, close handlers, and focus destinations.

**Rationale**: The approved architecture decision replaces the native dialog plan with shadcn Sheet. Sheet provides accessible overlay behavior and Tailwind customization while matching the required drawer UX. Independence preserves separate workspace navigation and Chat conversation state models.

**Alternatives considered**:

- Native `<dialog>`: obsolete decision after the approved shadcn architecture update unless a concrete Sheet incompatibility is discovered.
- Custom overlay with manual focus management: more code and less value than approved shadcn Sheet.
- Popover: non-modal behavior does not satisfy focus containment and obscured-content blocking.
- Mobile vertical stacking: allows long conversations to push messages/composer far below the viewport.

## Non-Chat Feature Scrolling

**Decision**: Let Main Content scroll for Documents, Tasks, Notes, and Memories while Chat uses a route-level overflow-hidden region with internal scroll hosts. Keep existing feature CSS unless minimal workspace wrapper integration is required.

**Rationale**: Other sections are document-like and do not require Chat's split-pane scroll contract. This preserves their behavior and avoids forcing the Tailwind/shadcn migration onto legacy features.

**Alternatives considered**:

- Internal scrolling for every feature: unnecessary and risks regressions in existing forms/lists.
- Whole-workspace document scrolling: fails Chat containment.
- Full legacy feature migration: explicitly out of T034 scope.

## Browser Regression Strategy

**Decision**: Add one focused `workspace.spec.ts` using isolated route interception, seeded session storage, deterministic records, deferred responses only for races, fixed desktop/mobile viewports, and geometry/scroll assertions with small rounding tolerances.

**Rationale**: The existing Playwright stack exercises real routing, storage, focus, layout, browser overflow, and shadcn Sheet behavior. Geometry and direct scroll measurements are more deterministic than wheel events or screenshots.

**Alternatives considered**:

- Unit tests for private hooks/state: would not validate browser layout, shadcn Sheet interaction, or route persistence.
- Screenshots as primary assertions: brittle and weaker for semantic/focus/scroll contracts.
- Arbitrary waits or `networkidle`: prone to flakiness and unrelated network timing.

## Dependencies

**Decision**: Add only approved Tailwind CSS setup packages, shadcn/ui initialization output, and dependencies required by selected shadcn primitives. Add no unrelated component library, global state library, query/cache library, or backend-facing dependency.

**Rationale**: The updated specification intentionally introduces Tailwind and shadcn/ui for the new workspace shell and Chat interface. Dependency impact is controlled by limiting primitive selection and preserving existing legacy UI.

**Alternatives considered**: continuing without UI dependencies was rejected because it conflicts with the updated spec; broad design-system or component-library migration was rejected because it exceeds T034 scope.
