# Feature Specification: Notes

**Feature Branch**: `main`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Create SPEC-004: Notes for Priora MindCloud. Allow an authenticated user inside the current MindSpace to view, create, and open notes through the existing backend."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse And Open Notes (Priority: P1)

An authenticated user with a valid current MindSpace can view its notes, select one, and read its title and content.

**Why this priority**: Finding and reading existing notes delivers the core reference value and establishes the context required for all further note activity.

**Independent Test**: Select a MindSpace containing notes, open Notes, select one note, and confirm that only notes from that MindSpace are listed and the selected note's title and content are readable.

**Acceptance Scenarios**:

1. **Given** an authenticated user has a valid current MindSpace, **When** the user opens Notes, **Then** only notes belonging to that MindSpace are listed.
2. **Given** a note appears in the list, **When** the user selects it, **Then** its title and complete plain-text content are displayed.
3. **Given** the current MindSpace has no notes, **When** Notes finishes loading, **Then** a clear empty state is displayed and note creation remains available.
4. **Given** no valid current MindSpace exists, **When** the user views the protected area, **Then** note listing, selection, and creation are unavailable and existing MindSpace guidance remains visible.

---

### User Story 2 - Create A Note (Priority: P2)

An authenticated user can create a plain-text note with a title and content in the current MindSpace and immediately open it.

**Why this priority**: Creating notes is the primary way users add durable information after they can access the Notes area.

**Independent Test**: Enter a valid title and content, submit once, and confirm the created note appears in the current list and opens without a page reload.

**Acceptance Scenarios**:

1. **Given** an authenticated user has a valid current MindSpace, **When** the user submits a non-empty title and non-empty content, **Then** one note is created in that MindSpace, added to the visible list, and selected for reading without a page reload.
2. **Given** either title or content contains only whitespace, **When** the user attempts to create the note, **Then** no creation request is made and clear validation identifies the invalid field or fields.
3. **Given** note creation is in progress, **When** the user attempts to submit again, **Then** duplicate creation is prevented and a clear in-progress state remains visible.
4. **Given** note creation fails, **When** the failure is reported, **Then** the entered title and content remain available for correction or resubmission and a safe error is displayed.

---

### User Story 3 - Preserve Context Across MindSpaces (Priority: P3)

An authenticated user can change the current MindSpace without seeing or interacting with stale notes from the previous MindSpace.

**Why this priority**: Strict separation between MindSpaces protects user context and prevents accidental confusion between unrelated notes.

**Independent Test**: Open a note, begin entering a new note, change MindSpace, and confirm the prior list, selection, draft fields, validation, and errors clear before the new MindSpace's notes appear.

**Acceptance Scenarios**:

1. **Given** a note is selected in the current MindSpace, **When** the user changes MindSpace, **Then** the previous note list, selection, displayed content, creation inputs, validation, and request errors clear before the new list is shown.
2. **Given** a note request from the previous MindSpace completes after the selection changes, **When** its result arrives, **Then** it does not replace or alter the new MindSpace context.
3. **Given** any notes operation reports that authentication is no longer valid, **When** the response is handled, **Then** existing authentication and MindSpace state are cleared and the user returns to login.

---

### Edge Cases

- The selected MindSpace has no notes.
- A note has a very long title or content; all content remains readable without breaking the page layout.
- Title or content contains leading or trailing whitespace; surrounding whitespace does not make an otherwise empty field valid.
- A list, create, or open request fails because of a network or service problem.
- A selected note is no longer available when the user attempts to open it.
- The user changes MindSpace while list, create, or open activity is still in progress.
- The user logs out while viewing or creating a note.
- The Notes experience is used in English LTR, Arabic RTL, with keyboard-only interaction, and at desktop and mobile widths.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Notes MUST be available only to authenticated users who have a valid current MindSpace.
- **FR-002**: The system MUST load notes belonging only to the current MindSpace and MUST NOT display notes from another MindSpace.
- **FR-003**: The notes list MUST provide distinct loading, empty, success, and safe error states.
- **FR-004**: Users MUST be able to select one listed note and read its title and complete plain-text content.
- **FR-005**: Selecting a note MUST load its authoritative record and provide distinct loading, success, unavailable, and safe error states.
- **FR-006**: Users MUST be able to create a note containing both a title and plain-text content in the current MindSpace.
- **FR-007**: The system MUST trim surrounding whitespace and reject creation when the resulting title or content is empty.
- **FR-008**: Invalid creation attempts MUST make no creation request and MUST present clear field-level or form-level validation.
- **FR-009**: The system MUST prevent duplicate submissions while note creation is active and MUST show a clear creation-in-progress state.
- **FR-010**: A successfully created note MUST be added to the current MindSpace's visible list and opened without a page reload.
- **FR-011**: Failed creation MUST preserve the user's entered title and content and display a safe error without exposing internal details.
- **FR-012**: When the current MindSpace changes, the system MUST immediately clear the previous note list, selected note, displayed content, creation inputs, validation, and request errors before loading the new MindSpace's notes.
- **FR-013**: Results from requests associated with a previous MindSpace or note selection MUST NOT overwrite the current context.
- **FR-014**: Note actions MUST be unavailable when no valid current MindSpace exists.
- **FR-015**: Unauthorized responses MUST follow existing authentication behavior by clearing authentication and current MindSpace selection and returning the user to login.
- **FR-016**: Existing logout behavior MUST continue to clear authentication and current MindSpace selection.
- **FR-017**: All note labels, validation, loading, empty, and error text MUST be available in English and Arabic.
- **FR-018**: English MUST use LTR direction and Arabic MUST use RTL direction without changing feature behavior.
- **FR-019**: The notes list, creation fields, note selection, and reading view MUST be keyboard accessible, clearly labeled, and usable at desktop and mobile widths.
- **FR-020**: The frontend MUST communicate only with the existing application backend for note operations and MUST NOT directly access internal data or intelligence services.
- **FR-021**: The frontend MUST use the existing authenticated user context and MUST NOT submit a user identifier for note operations.
- **FR-022**: This feature MUST NOT add note editing, deletion, rich text or Markdown editing, tags, search, sorting or filtering controls, attachments, sharing, version history, agent-specific note behavior, complex pagination, or globally shared notes state.
- **FR-023**: The feature MUST use existing application capabilities and MUST NOT require new user-facing infrastructure or dependencies.

### API Boundary *(mandatory for frontend features)*

- **NestJS Endpoints Used**: `GET /api/v1/notes?mindSpaceId=<mindSpaceId>` returns notes for the current MindSpace; `POST /api/v1/notes` accepts `{mindSpaceId, title, content}` and returns the created note; `GET /api/v1/notes/:id` returns the selected note. Each note record contains its identifier, MindSpace identifier, title, content, and timestamps. Update and delete operations are excluded.
- **Authentication Context**: Requests use the existing authenticated session or access token. The current MindSpace and selected note identifiers are supplied only where required; `userId` is never submitted by the frontend.
- **Excluded Direct Access**: The frontend does not directly access Agent, RAG, Qdrant, PostgreSQL, Supabase, storage services, or other internal services.

### Key Entities *(include if feature involves data)*

- **Note**: A plain-text record belonging to one MindSpace, with a stable identifier, title, content, and creation and update timestamps.
- **Current MindSpace**: The authenticated user's selected workspace context; it determines which notes may be listed or created.
- **Selected Note**: The note currently open for reading; it remains valid only while it belongs to the current MindSpace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of authenticated users with a valid MindSpace can open Notes, select an existing note, and read its title and content on their first attempt without assistance.
- **SC-002**: Users can create and open a valid note in no more than one submission and without manually refreshing the page.
- **SC-003**: Empty or whitespace-only title and content submissions result in zero created notes, and repeated actions during an active creation result in no duplicate notes.
- **SC-004**: In all tested MindSpace changes, content from the previous MindSpace is removed before notes for the new MindSpace are displayed, including when earlier requests finish late.
- **SC-005**: Every notes data area displays exactly one clear loading, empty, success, unavailable, or error state appropriate to its current condition.
- **SC-006**: All planned Notes tasks can be completed using keyboard-only interaction in both English LTR and Arabic RTL at representative desktop and mobile widths.
- **SC-007**: Network and authorization failures expose no internal error details and always leave the user with a clear next state, such as preserved input, safe retry context, or return to login.
- **SC-008**: Acceptance testing confirms that no out-of-scope note management capability, direct internal-service access, globally shared notes state, or new user-facing dependency is introduced.

## Assumptions

- Existing authentication, logout, locale direction, and current MindSpace selection remain available and authoritative.
- The existing backend supports listing notes for a MindSpace, creating a note, and reading one note while enforcing ownership for the authenticated user.
- A note title and content have no additional minimum length beyond containing at least one non-whitespace character, and existing backend limits remain authoritative.
- The backend's default note order is acceptable; user-controlled sorting and filtering are out of scope.
- Notes use plain text. Preserving line breaks for reading is sufficient; formatting and rich-text interpretation are out of scope.
- The number of notes and amount of content expected in this release can be handled without complex pagination.
