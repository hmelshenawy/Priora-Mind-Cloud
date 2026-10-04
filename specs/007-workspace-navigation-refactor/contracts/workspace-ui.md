# UI Contract: T034 Workspace Shell, Navigation & Chat UX Refactor

This contract defines externally observable frontend behavior. It changes no NestJS endpoint or payload.

## Route Contract

| Route | Protected | Active Section | Content |
|-------|-----------|----------------|---------|
| `/{locale}/app` | Yes after redirect | N/A | Server redirect to `/{locale}/app/chat` |
| `/{locale}/app/chat` | Yes | Chat | Tailwind/shadcn Chat for selected MindSpace |
| `/{locale}/app/documents` | Yes | Documents | Existing Documents for selected MindSpace |
| `/{locale}/app/tasks` | Yes | Tasks | Existing Tasks for selected MindSpace |
| `/{locale}/app/notes` | Yes | Notes | Existing Notes for selected MindSpace |
| `/{locale}/app/memories` | Yes | Memories | Translated non-functional placeholder |

Rules:

- `{locale}` is `en` or `ar` and remains unchanged during workspace navigation and redirects.
- Direct load, refresh, back, and forward resolve the same section and active navigation state.
- Unknown child routes use normal not-found behavior.
- Unauthenticated direct child loads replace to same-locale login after client auth validation.

## Styling And Dependency Contract

- Tailwind CSS is the primary styling approach for new T034 workspace shell and Chat UI.
- shadcn/ui primitives are used selectively for Sheet, Button, Select, DropdownMenu, Avatar, Tooltip, and ScrollArea only where behavior remains explicit and testable.
- Existing global CSS remains valid for Documents, Tasks, Notes, Login, Register, and onboarding.
- Priora visual identity remains warm/light, cream-card oriented, restrained, dark-control, rounded, and professional.
- No unrelated component library, broad icon library, global state library, query/cache library, or full design-system migration is introduced.

## Persistent Shell Contract

- Sibling section navigation keeps one `AuthGate`/`AppShell` subtree mounted.
- Shell fetches MindSpaces once per mounted workspace document, not once per sibling route.
- Active feature content does not mount until one selected ID has been validated against the owned response.
- Only active route feature content is mounted.
- A full document refresh re-runs authentication and MindSpace initialization.
- Logout from every child route clears both existing session keys and reaches same-locale login.

## MindSpace Context Contract

Provider value:

```text
selectedMindSpaceId: non-empty string
```

Preconditions:

- Authentication exists.
- MindSpace request succeeded.
- ID exists in the latest owned MindSpace list.

Consumer behavior:

- Chat, Documents, Tasks, and Notes receive the exact provider ID as `mindSpaceId`.
- Route pages do not load, validate, select, or persist MindSpaces.
- Changing selection updates the currently mounted feature through its existing prop-change contract.
- Memories may participate in shell selection presentation but sends no request.

## Workspace Navigation Contract

- Semantic navigation exposes Chat, Documents, Tasks, Notes, and Memories in that order.
- Each item is a locale-prefixed link.
- Exactly one link on a known child route has `aria-current="page"` and visible non-color-only active styling.
- Desktop navigation is persistent and styled with Tailwind/shadcn where useful.
- Mobile navigation uses shadcn Sheet, starts closed, and is controlled by a labeled button with matching `aria-controls` and `aria-expanded`.
- Mobile navigation closes by close control, Escape, backdrop action, or route activation.
- Dismissal restores opener focus; route activation transfers focus to new Main Content/section heading.
- Mobile Sheet opens from logical inline start in both LTR and RTL.
- Workspace Sheet state remains independent from Chat conversation Sheet state.

## Header Contract

- Displays current translated section title for a known route.
- Displays current MindSpace and existing selector/create behavior when available.
- Uses shadcn Button, Select or DropdownMenu, Avatar-style email identity, and Tooltip where useful.
- Displays authenticated email; optional initial is derived only from email.
- Provides logout/account action with existing semantics.
- Provides the mobile workspace-menu control.
- Does not display or request name/avatar/profile data.

## Feature Lifecycle Contract

- Sibling route navigation unmounts the old feature and mounts the new feature.
- Feature-local lists, drafts, active records, errors, success messages, panel state, and scroll positions are not guaranteed to survive unmount.
- Auth and validated MindSpace remain shared while the workspace layout persists.
- Returning to a route invokes that feature's existing mount/list behavior.
- Pending work from an unmounted feature must not update visible current-route content.

## Desktop Chat Layout Contract

- Chat is styled primarily with Tailwind and selected shadcn primitives.
- Workspace root height differs from browser viewport height by no more than 2 CSS pixels in the long-data regression fixture.
- Header, workspace navigation, conversation controls, and composer remain accessible.
- Conversation list scroll host reports vertical overflow when long.
- Message scroll host reports vertical overflow when long.
- Scrolling one Chat host does not change the other's scroll position.
- Composer is a non-scrolling message-pane row; long messages do not push it outside the viewport.
- Chat content creates no horizontal document overflow.
- If shadcn ScrollArea is used, the actual measured scroll element must remain directly accessible. Native overflow is preferred for message history when measurement would otherwise be obscured.

## Chat Scroll Contract

Define on the actual message scroll host:

```text
remaining = max(0, scrollHeight - clientHeight - scrollTop)
nearBottom = remaining <= 80
```

| Event | Required Scroll Result |
|-------|------------------------|
| Initial accepted messages for opened conversation | Bottom after render |
| Accepted messages after switching conversation | New conversation bottom after render |
| Same-conversation update when near bottom | Bottom after render |
| Same-conversation update when remaining > 80 | No forced scroll write |
| Send begun near bottom | Bottom after accepted refreshed messages render |
| Send begun above threshold, then user returns near bottom before refresh render | Bottom after render |
| Send begun above threshold and user remains above threshold | Preserve reading position |
| MindSpace switch | Clear prior scroll intent before new conversation state |
| Chat unmount | Invalidate pending data and scroll continuations |

Accepted bottom position in automated checks has at most 1 CSS pixel remaining. Preserved position allows at most 2 CSS pixels of browser rounding difference.

## Mobile Chat Contract

- Conversation navigation uses a Chat-local shadcn Sheet, not a long block above messages.
- Its opener has IDs and ARIA state distinct from workspace navigation.
- It has bounded internal list overflow.
- Selecting a conversation closes the Chat Sheet and focuses the selected conversation heading or message region.
- Escape/backdrop/close dismissal restores its own opener.
- Workspace Sheet interaction does not clear active conversation, messages, or composer state.
- Message region receives remaining Chat height and composer remains operable above the viewport/safe-area edge.

## Direction And Translation Contract

- Existing locale layout remains the only direction owner.
- All new visible/accessibility text exists in `frontend/messages/en.json` and `frontend/messages/ar.json`.
- Desktop Sidebar and mobile Sheets occupy logical inline start.
- Arabic links retain `/ar/`; English links retain `/en/`.
- Long English/Arabic labels, email, MindSpace names, titles, and content do not create horizontal viewport overflow.

## Existing Backend Contract Preservation

- Existing API modules, methods, payloads, response models, bearer authentication, and error mapping remain unchanged.
- No request sends `userId`.
- No request is made for Memories.
- No frontend call bypasses NestJS.
- No backend endpoint, profile field, polling behavior, or feature capability is added.
