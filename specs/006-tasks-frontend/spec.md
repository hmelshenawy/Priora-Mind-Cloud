# Feature Specification: Tasks Frontend

**Feature Branch**: `006-tasks-frontend`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Create SPEC-006: Tasks Frontend for Priora MindCloud. Add a minimal Tasks area inside the selected MindSpace so users can view and create tasks through the existing backend with clear request states, validation, MindSpace isolation, and existing EN/AR support."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View MindSpace Tasks (Priority: P1)

An authenticated user with a valid current MindSpace can open Tasks and see that MindSpace's tasks with enough information to understand each item.

**Why this priority**: A trustworthy list of current tasks is the minimum useful task-management experience and establishes the context for task creation.

**Independent Test**: Select a MindSpace containing tasks, open Tasks, and confirm that only tasks from that MindSpace appear in the order supplied by the backend with their title, optional description, executor, status, and creation date.

**Acceptance Scenarios**:

1. **Given** an authenticated user has a valid current MindSpace, **When** the user opens Tasks, **Then** only tasks belonging to that MindSpace are listed in backend-provided order.
2. **Given** tasks are returned for the current MindSpace, **When** the list is displayed, **Then** each task shows its title, executor, status, and creation date, and shows its description when one exists.
3. **Given** the current MindSpace has no tasks, **When** loading finishes, **Then** a clear empty state is shown and task creation remains available.
4. **Given** the task list is loading or cannot be loaded, **When** the user views Tasks, **Then** a distinct loading or safe error state is shown without stale task content.
5. **Given** no valid current MindSpace exists, **When** the user views the protected area, **Then** task listing and creation are unavailable and the existing MindSpace guidance remains visible.

---

### User Story 2 - Create A Task (Priority: P2)

An authenticated user can create a task with a required title, an optional description, and a supported executor in the current MindSpace and see it without reloading the page.

**Why this priority**: Creation lets users turn intentions into durable items after they can understand the current task list.

**Independent Test**: Enter a valid title, optionally enter a description and choose an executor, submit once, and confirm that the returned task appears in the current list without a page reload.

**Acceptance Scenarios**:

1. **Given** an authenticated user has a valid current MindSpace, **When** the user submits a non-empty title with valid optional fields, **Then** one create request is made for that MindSpace and the returned task appears without a page reload.
2. **Given** the title is empty or contains only whitespace, **When** the user attempts to create a task, **Then** no create request is made and a clear validation message identifies the title requirement.
3. **Given** task creation is active, **When** the user attempts to submit again, **Then** duplicate submission is prevented and a clear submitting state remains visible.
4. **Given** creation succeeds, **When** the response is accepted for the current MindSpace, **Then** the creation form closes or returns to its inactive state, its fields and errors reset, the returned task appears immediately, and the current task list is revalidated without a page reload.
5. **Given** creation fails, **When** the failure is reported, **Then** the entered values remain available for correction or another attempt and a user-friendly error is displayed.
6. **Given** creation succeeds but the following list revalidation fails, **When** the failure is reported, **Then** the accepted task remains visible and a safe refresh error is shown without changing creation to failure.

---

### User Story 3 - Preserve MindSpace Context (Priority: P3)

An authenticated user can switch MindSpaces without seeing or interacting with tasks or form state from the previously selected MindSpace.

**Why this priority**: Strict context isolation prevents users from confusing tasks across unrelated areas of their second brain.

**Independent Test**: Load tasks or begin creating a task in one MindSpace, switch to another, and confirm that previous tasks and creation state clear immediately and late results do not affect the newly selected context.

**Acceptance Scenarios**:

1. **Given** task list or creation state exists for the current MindSpace, **When** the user changes MindSpace, **Then** the previous list, form values, validation, success state, and errors clear before the new MindSpace's tasks load.
2. **Given** a list or create request from the previous MindSpace finishes after selection changes, **When** its non-authentication result arrives, **Then** it does not alter the current MindSpace's list or user-visible state; a current-session authentication failure still follows session-wide login behavior.
3. **Given** a task operation reports that authentication is no longer valid, **When** the response is handled, **Then** existing authentication and MindSpace cleanup and return-to-login behavior occur.
4. **Given** the user chooses English or Arabic, **When** Tasks is displayed, **Then** feature text and layout use the selected language and corresponding LTR or RTL direction.

---

### Edge Cases

- The selected MindSpace has no tasks.
- A task has no description; no empty description placeholder is required in the task card.
- A title or description is long, contains Arabic, or includes line breaks; content remains readable without breaking the layout.
- A title contains only whitespace; surrounding whitespace cannot make an empty title valid.
- The backend returns an unfamiliar status or executor value; it is presented safely rather than replaced with a frontend-invented value.
- A create response returns a task identifier already present in the list; the list contains only one item with that identifier.
- A list or create request fails because of a validation, network, rate-limit, ownership, or service problem; internal details are not exposed.
- The user changes MindSpace or logs out while list or create activity is active.
- A late success or non-authentication failure arrives from a previously selected MindSpace; it is ignored. A late 401 is applied only if its request token still identifies the current authentication session.
- Tasks is used with keyboard-only interaction, in English LTR and Arabic RTL, and at representative desktop and mobile widths.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tasks MUST be available only to authenticated users who have a valid current MindSpace.
- **FR-002**: Tasks MUST appear inside the existing protected MindSpace application area and use the application's current MindSpace selection rather than a separate or hardcoded selection.
- **FR-003**: The system MUST request tasks for exactly the current MindSpace and MUST NOT display tasks belonging to another MindSpace.
- **FR-004**: The task list MUST preserve the order supplied by the backend and MUST NOT apply an additional user-facing sort.
- **FR-005**: The task list MUST provide distinct loading, empty, success, and safe error states.
- **FR-006**: Each listed task MUST show its title, backend-provided executor, status, and creation date, plus its description when present.
- **FR-007**: Backend-owned task metadata MUST be treated as authoritative; unfamiliar safe executor or status values MUST remain identifiable and MUST NOT be replaced by inferred values.
- **FR-008**: Users MUST be able to start and dismiss a simple task-creation form while a valid current MindSpace is selected.
- **FR-009**: The creation form MUST accept a required title, an optional description, and one executor supported by the backend: `USER` or `AGENT`.
- **FR-010**: The system MUST trim surrounding title whitespace and MUST reject creation when the resulting title is empty.
- **FR-011**: Invalid title submissions MUST make no create request and MUST show a clear validation message associated with the title or form.
- **FR-012**: A valid create request MUST include the current MindSpace identifier, title, optional description, and selected executor, and MUST NOT include a user identifier or frontend-defined status.
- **FR-013**: The system MUST prevent additional submissions while task creation is active and MUST show a clear submitting state.
- **FR-014**: Following successful creation for the current MindSpace, the form MUST close or become inactive, clear its fields and errors, show the returned task immediately, and perform one current-MindSpace list revalidation without a full page reload.
- **FR-015**: Incorporating a create response MUST NOT produce duplicate visible tasks when the returned identifier already exists in the current list.
- **FR-016**: Failed creation MUST preserve the user's entered values and display a user-friendly error without exposing internal details.
- **FR-017**: Backend validation messages that are safe and actionable MUST be represented in user-friendly language; internal or unknown failures MUST use a safe general message.
- **FR-018**: Failed post-create revalidation MUST preserve the accepted task and current list and show a safe refresh error without reporting that task creation failed.
- **FR-019**: When the current MindSpace changes, the system MUST immediately clear the previous task list, creation inputs, validation, submitting state, success state, and errors before loading the new MindSpace's tasks.
- **FR-020**: Success and non-authentication failure results from list or create requests associated with a previous MindSpace MUST NOT overwrite or append to the current context; current-session 401 handling remains governed by FR-022.
- **FR-021**: Task actions MUST be unavailable when no valid current MindSpace exists.
- **FR-022**: Unauthorized responses for the current authentication session MUST follow existing authentication behavior by clearing authentication and current MindSpace selection and returning the user to login; a response from a replaced authentication session MUST NOT clear the newer session.
- **FR-023**: Existing logout behavior MUST remain unchanged.
- **FR-024**: All task labels, executor and known status labels, validation, loading, empty, submitting, success, and error text MUST be available in English and Arabic.
- **FR-025**: English MUST use LTR direction and Arabic MUST use RTL direction without changing feature behavior.
- **FR-026**: The task list, creation controls, fields, and all user states MUST be keyboard accessible, clearly labeled, and usable at desktop and mobile widths.
- **FR-027**: The frontend MUST communicate only with the existing application backend for task operations and MUST NOT directly access databases, Agent, retrieval systems, storage, or other internal services.
- **FR-028**: The frontend MUST use the existing authenticated user context and MUST NOT submit a user identifier for task operations.
- **FR-029**: This feature MUST NOT add task editing, deletion, status changes, drag-and-drop, boards, kanban, recurring tasks, reminders, notifications, scheduling, subtasks, priorities, tags, filters, task search, AI planning, background processing, automation, or new backend architecture.
- **FR-030**: Choosing `AGENT` as executor MUST record only the supported executor value and MUST NOT directly invoke or imply execution by an Agent.
- **FR-031**: The feature MUST reuse existing application capabilities and MUST NOT require a second integration abstraction, globally shared Tasks state, or new user-facing dependencies.

### API Boundary *(mandatory for frontend features)*

- **NestJS Endpoints Used**: `GET /api/v1/tasks?mindSpaceId=<mindSpaceId>` returns the requested owned MindSpace's tasks as an ordered list. `POST /api/v1/tasks` accepts `{mindSpaceId, title, description?, executor?}` and returns the persisted task. A task record contains `id`, `mindSpaceId`, `title`, nullable `description`, `executor`, `status`, `createdAt`, and `updatedAt`. Executor values supported for creation are `USER` and `AGENT`; status, get-one, update, and delete operations are excluded from this feature.
- **Authentication Context**: Requests use the existing authenticated session or access token. The current `mindSpaceId` is supplied where required; `userId` is never submitted by the frontend, and ownership is determined from authenticated context.
- **Excluded Direct Access**: The frontend does not directly access Agent, RAG, Qdrant, PostgreSQL, Supabase, storage services, or other internal services.

### Key Entities *(include if feature involves data)*

- **Task**: A durable item belonging to one MindSpace, identified by a stable identifier and described by a title, optional description, executor, status, creation time, and update time.
- **Current MindSpace**: The authenticated user's selected workspace context; it determines which tasks may be listed and where a task may be created.
- **Executor**: Backend-supported metadata indicating whether a task is assigned to the user or Agent; it does not initiate task execution.
- **Task Draft**: Temporary title, description, executor selection, validation, and submission state for a potential task; it remains valid only for the current MindSpace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated user with a valid MindSpace can open Tasks and identify every listed task's title, executor, status, and creation date without assistance; descriptions are identifiable whenever present.
- **SC-002**: Every task-list attempt results in exactly one clear loading, success, empty, or safe error state appropriate to its current condition.
- **SC-003**: At least 90% of representative users can create a valid task on their first attempt in no more than one form submission and see it in the list without reloading the page.
- **SC-004**: Across all acceptance tests, empty or whitespace-only titles produce zero create requests, and repeated actions during an active submission produce no additional create requests.
- **SC-005**: In 100% of tested MindSpace changes, prior tasks and creation state disappear before the new context is shown, and late prior-context success or non-authentication failure results make no visible change.
- **SC-006**: In 100% of successful-create tests, the returned task appears once in the current MindSpace list within one visible update cycle, one list revalidation follows, and no full page reload is required.
- **SC-007**: All planned task-list and creation actions can be completed using keyboard-only interaction in English LTR and Arabic RTL at representative desktop and mobile widths.
- **SC-008**: Validation, network, ownership, rate-limit, service, and authorization failures expose no internal details and always leave the user with a clear next state, such as preserved input, retry context, or return to login.
- **SC-009**: Acceptance testing confirms that no task from a previously selected MindSpace is visible or inserted after the current MindSpace changes.
- **SC-010**: Acceptance testing confirms that no out-of-scope task-management capability, direct internal-service access, Agent invocation, globally shared Tasks state, second integration abstraction, or new user-facing dependency is introduced.

## Assumptions

- Existing authentication, logout, locale direction, protected application shell, and current MindSpace selection remain available and authoritative.
- The existing backend enforces authentication and MindSpace ownership for listing and creating tasks.
- The backend returns task lists in its intended display order; user-controlled sorting and filtering are out of scope.
- New tasks default to backend-owned status and executor values when omitted, but the creation experience exposes only the currently supported executor choices `USER` and `AGENT`.
- `AGENT` is assignment metadata only for this release and does not trigger AI execution or automation.
- A task title has no additional minimum length beyond containing at least one non-whitespace character; backend validation remains authoritative for all other rules.
- Descriptions are optional plain text. Empty descriptions need not occupy space in the task list.
- Creation may return an existing recently matching task under backend deduplication behavior; the returned task is treated as authoritative and is shown only once.
- The expected number of tasks can be displayed without pagination or complex filtering for this release.
- Existing frontend verification tooling may be supplemented only as needed to cover the required task behaviors consistently with the project; introducing a broad new testing architecture is not part of this feature.
