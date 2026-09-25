# Feature Specification: MindSpace App Shell

**Feature Branch**: `main`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Create SPEC-002: MindSpace + App Shell for Priora MindCloud. Authenticated users can enter a protected app shell, load and select one of their MindSpaces, preserve that selection, and see clear loading, empty, and error states in English and Arabic."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter the App Shell (Priority: P1)

An authenticated user opens the main application and sees a simple shell with Priora MindCloud branding, logout, navigation placeholders, and their MindSpaces loaded from the backend.

**Why this priority**: The shell and MindSpace list establish the minimum context required by later authenticated product features.

**Independent Test**: Log in, open the app, and confirm the shell appears and displays the authenticated user's MindSpaces.

**Acceptance Scenarios**:

1. **Given** the user is authenticated, **When** they open the app, **Then** the shell loads their MindSpaces from NestJS and displays the available choices.
2. **Given** the user is not authenticated, **When** they open the app, **Then** they are redirected to login.

---

### User Story 2 - Select a Current MindSpace (Priority: P2)

An authenticated user can select one available MindSpace and see its name as the current context in the app shell.

**Why this priority**: Later product screens need one clear current MindSpace without introducing global application state architecture.

**Independent Test**: Select a MindSpace, refresh the app, and confirm the same valid selection remains current.

**Acceptance Scenarios**:

1. **Given** multiple MindSpaces are available, **When** the user selects one, **Then** its name is shown as the current MindSpace.
2. **Given** a valid MindSpace was previously selected, **When** the user refreshes the app, **Then** that MindSpace remains selected.
3. **Given** the stored selection no longer appears in the returned MindSpaces, **When** the list loads, **Then** an available MindSpace is selected safely instead.

---

### User Story 3 - Understand Non-Success States (Priority: P3)

An authenticated user sees clear feedback while MindSpaces load, when none exist, or when the request fails.

**Why this priority**: The shell must remain understandable and usable when data is unavailable.

**Independent Test**: Exercise loading, empty-list, and failed-request responses and confirm each produces a distinct user-facing state.

**Acceptance Scenarios**:

1. **Given** MindSpaces are being requested, **When** the user views the shell, **Then** a clear loading state is shown.
2. **Given** the user has no MindSpaces, **When** loading completes, **Then** a simple empty state is shown without creation controls.
3. **Given** the MindSpace request fails, **When** the shell receives the failure, **Then** a safe user-facing error is shown without sensitive backend details.

---

### Edge Cases

- A stored MindSpace selection does not exist in the latest returned list.
- The returned MindSpace list contains exactly one item.
- The user logs out while viewing the app shell.
- The shell is viewed in English LTR, Arabic RTL, desktop, and mobile layouts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Unauthenticated users MUST be redirected to login when opening the app shell.
- **FR-002**: Authenticated users MUST see a simple app shell containing Priora MindCloud branding, current MindSpace context, logout, and navigation placeholders.
- **FR-003**: The frontend MUST load only the authenticated user's MindSpaces from the existing NestJS MindSpaces endpoint.
- **FR-004**: The shell MUST show distinct loading, empty, success, and error states for the MindSpace request.
- **FR-005**: Users MUST be able to select one MindSpace from the returned list.
- **FR-006**: The selected MindSpace name MUST be visible in the app shell.
- **FR-007**: The selected MindSpace MUST be preserved across refresh using the simplest frontend-side mechanism compatible with the existing application.
- **FR-008**: If a stored selection is absent from the latest returned list, the shell MUST select an available MindSpace safely and replace the stale selection.
- **FR-009**: If exactly one MindSpace exists and no valid selection is stored, that MindSpace MUST become current.
- **FR-010**: If no MindSpaces exist, the shell MUST show an empty state and MUST NOT add create, edit, rename, or delete behavior.
- **FR-011**: API or network failures MUST show a safe user-facing error without raw stack traces or sensitive response data.
- **FR-012**: Logout MUST continue to clear authenticated frontend state and return the user to login.
- **FR-013**: Shell labels, states, selector text, navigation placeholders, and logout text MUST support English and Arabic.
- **FR-014**: English MUST use LTR direction and Arabic MUST use RTL direction.
- **FR-015**: The MindSpace selector and logout control MUST be keyboard accessible and clearly labeled.
- **FR-016**: The app shell MUST remain usable on desktop and mobile screens without complex responsive navigation behavior.
- **FR-017**: Navigation placeholders MAY be shown when useful for the shell, but MUST remain non-functional and MUST NOT add destination screens.
- **FR-018**: The frontend MUST NOT introduce a global state library, new auth framework, or speculative application-state architecture.
- **FR-019**: The frontend MUST communicate only with NestJS and MUST NOT call Agent, RAG, Qdrant, PostgreSQL, Supabase, or storage services directly.
- **FR-020**: The frontend MUST NOT send `userId` to retrieve MindSpaces because authenticated backend context identifies the user.

### API Boundary *(mandatory for frontend features)*

- **NestJS Endpoints Used**: Existing authenticated `GET /api/v1/mindspaces`. The frontend follows the actual existing NestJS response contract without assuming a different response envelope.
- **Authentication Context**: The request uses the existing frontend authentication state and backend token contract. The frontend does not send `userId`.
- **Excluded Direct Access**: Frontend does not directly access Agent, RAG, Qdrant, PostgreSQL, Supabase, storage services, or other internal services.

### Key Entities *(include if feature involves data)*

- **MindSpace**: A backend-owned user workspace identified by an ID and displayed by name.
- **Current MindSpace Selection**: The ID of one returned MindSpace chosen as the frontend context; it is valid only while that ID exists in the latest returned list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated user can open the app shell and see either their MindSpace choices or one clear loading, empty, or error state.
- **SC-002**: A user can select a MindSpace in one interaction and immediately see its name as the current context.
- **SC-003**: Refreshing the app preserves a valid selected MindSpace, while a stale selection falls back to an available MindSpace without blocking the shell.
- **SC-004**: Unauthenticated users cannot view the protected shell, and logout removes access until the user logs in again.
- **SC-005**: The complete shell experience is usable in English LTR, Arabic RTL, desktop, mobile, and keyboard-only interaction.
- **SC-006**: No product destination beyond the shell and MindSpace selection is delivered by this feature.

## Assumptions

- The existing authentication state supplies the access token required by the NestJS MindSpaces endpoint.
- MindSpaces returned by NestJS contain stable IDs and displayable names.
- When no valid selection exists and MindSpaces are available, the first returned MindSpace is an acceptable fallback.
- Navigation entries are non-functional placeholders in this feature.
