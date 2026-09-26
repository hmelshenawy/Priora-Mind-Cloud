# Feature Specification: Documents

**Feature Branch**: `005-mindspace-documents`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Create SPEC-005: Documents for Priora MindCloud. Allow an authenticated user inside the current MindSpace to view and upload PDF documents through the existing NestJS backend."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View MindSpace Documents (Priority: P1)

An authenticated user with a valid current MindSpace can open Documents and see that MindSpace's uploaded document filenames and processing statuses.

**Why this priority**: A trustworthy, context-specific document list is the foundation for understanding what knowledge is available and whether each document is ready.

**Independent Test**: Select a MindSpace containing documents, open Documents, and confirm that only documents from that MindSpace appear with their filenames and backend-reported statuses.

**Acceptance Scenarios**:

1. **Given** an authenticated user has a valid current MindSpace, **When** the user opens Documents, **Then** only documents belonging to that MindSpace are listed with a filename and processing status.
2. **Given** the current MindSpace has no documents, **When** loading finishes, **Then** a clear empty state is shown and PDF upload remains available.
3. **Given** the list is loading or cannot be loaded, **When** the user views Documents, **Then** a clear loading or safe error state is shown without displaying stale documents.
4. **Given** no valid current MindSpace exists, **When** the user views the protected area, **Then** document listing and upload are unavailable and the existing MindSpace guidance remains visible.

---

### User Story 2 - Upload One PDF (Priority: P2)

An authenticated user can select and upload one PDF to the current MindSpace, see a clear outcome, and see the new document in the list immediately when the returned record contains the required display information.

**Why this priority**: Uploading is how users add documents to their MindSpace after they can understand its existing document collection.

**Independent Test**: Select one valid PDF, submit it once, and confirm that one upload occurs and the returned document appears with its backend-reported status without a page reload when complete document metadata is returned.

**Acceptance Scenarios**:

1. **Given** an authenticated user has a valid current MindSpace and selects one PDF, **When** the user submits it, **Then** one document is uploaded to that MindSpace and a success state is shown.
2. **Given** a successful upload returns the document identifier, MindSpace identifier, filename, and status, **When** the response is accepted, **Then** the new document appears in the visible list without a page reload.
3. **Given** no file is selected, **When** the user attempts to upload, **Then** no upload request is made and a clear validation message is shown.
4. **Given** a selected file is not a PDF, **When** the user attempts to upload, **Then** no upload request is made and a clear validation message is shown.
5. **Given** an upload is active, **When** the user attempts to submit again, **Then** duplicate submission is prevented and the active state remains visible.
6. **Given** an upload fails, **When** the failure is reported, **Then** the selected file remains available for correction or another attempt and a safe error is shown.

---

### User Story 3 - Preserve MindSpace And Session Context (Priority: P3)

An authenticated user can change MindSpace, locale, or session state without documents from one context leaking into another or existing authentication behavior changing.

**Why this priority**: Context isolation protects user trust and ensures the Documents area remains consistent with the rest of the application.

**Independent Test**: Start loading or uploading in one MindSpace, change MindSpace, and confirm that all previous document state clears immediately and late results do not affect the newly selected context.

**Acceptance Scenarios**:

1. **Given** document state exists for the current MindSpace, **When** the user changes MindSpace, **Then** the previous list, selected file, validation, upload state, success state, and errors clear before the new MindSpace's documents load.
2. **Given** a list or upload request from the previous MindSpace finishes after the selection changes, **When** its result arrives, **Then** it does not alter the current MindSpace's list or user-visible state.
3. **Given** a document operation reports that authentication is no longer valid, **When** the response is handled, **Then** existing authentication and MindSpace cleanup and return-to-login behavior occur.
4. **Given** the user logs out from Documents, **When** logout completes, **Then** the existing logout behavior remains unchanged.
5. **Given** the user chooses English or Arabic, **When** Documents is displayed, **Then** its text and layout use the selected language and the corresponding LTR or RTL direction.

---

### Edge Cases

- The selected MindSpace has no documents.
- The selected file has a `.pdf` filename but is explicitly reported by the browser as a non-PDF type; it is rejected before upload, while the backend remains authoritative about actual file content.
- A filename is long or contains Arabic, spaces, or common punctuation; it remains identifiable without breaking the layout.
- A list or upload request fails because of a network or service problem, and raw internal details are not shown.
- An upload succeeds but its response does not contain a complete displayable document record; success is shown without inventing a filename or status, and the list remains authoritative on its next load.
- The backend reports an unfamiliar processing status; the exact safe status text remains visible rather than being replaced with a frontend-derived status.
- The user changes MindSpace or logs out while loading or uploading is active.
- A late success or failure arrives from a previously selected MindSpace.
- Documents is used with keyboard-only interaction, in English LTR and Arabic RTL, and at desktop and mobile widths.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Documents MUST be available only to authenticated users who have a valid current MindSpace.
- **FR-002**: The system MUST load documents belonging only to the current MindSpace and MUST NOT display documents from another MindSpace.
- **FR-003**: The document list MUST provide distinct loading, empty, success, and safe error states.
- **FR-004**: Each listed document MUST show its backend-provided filename and processing status.
- **FR-005**: The system MUST treat the backend-reported processing status as authoritative and MUST NOT infer a replacement status from frontend activity.
- **FR-006**: Users MUST be able to select and upload exactly one PDF at a time to the current MindSpace.
- **FR-007**: The system MUST reject an upload attempt before making a request when no file is selected, the filename does not end in `.pdf` case-insensitively, or the browser explicitly identifies the file as a non-PDF type.
- **FR-008**: Invalid upload attempts MUST show a clear validation message and MUST result in zero upload requests.
- **FR-009**: The system MUST prevent additional upload submissions while an upload is active and MUST show a clear upload-in-progress state.
- **FR-010**: A successful upload MUST show a clear success state and clear the accepted file selection.
- **FR-011**: When a successful upload response includes a complete document record for the current MindSpace, the system MUST add that document to the visible list without a page reload and MUST avoid adding a duplicate record.
- **FR-012**: When a successful upload response does not include a complete displayable document record, the system MUST NOT fabricate one or expose storage details.
- **FR-013**: A failed upload MUST preserve the selected file when possible and display a safe error without exposing internal details.
- **FR-014**: When the current MindSpace changes, the system MUST immediately clear the previous document list, selected file, validation, upload state, success state, and errors before loading the new MindSpace's documents.
- **FR-015**: Results from list or upload requests associated with a previous MindSpace MUST NOT overwrite or append to the current context.
- **FR-016**: Document actions MUST be unavailable when no valid current MindSpace exists.
- **FR-017**: Unauthorized responses MUST follow existing authentication behavior by clearing authentication and current MindSpace selection and returning the user to login.
- **FR-018**: Existing logout behavior MUST remain unchanged.
- **FR-019**: All document labels, statuses, validation, loading, empty, success, and error text MUST be available in English and Arabic; backend-provided status values without a known translation MUST still be presented safely.
- **FR-020**: English MUST use LTR direction and Arabic MUST use RTL direction without changing feature behavior.
- **FR-021**: The document list, file input, upload action, and all user states MUST be keyboard accessible, clearly labeled, and usable at desktop and mobile widths.
- **FR-022**: The frontend MUST communicate only with the existing application backend for document operations and MUST NOT directly access storage, databases, retrieval systems, or other internal services.
- **FR-023**: The frontend MUST use the existing authenticated user context and MUST NOT submit a user identifier for document operations.
- **FR-024**: This feature MUST NOT add preview, deletion, renaming, drag-and-drop, multi-file upload, upload percentage, complex polling, ingestion retry, search, citations, retrieval-result UI, chat attachments, complex pagination, or globally shared Documents state.
- **FR-025**: The feature MUST reuse existing application capabilities and MUST NOT require new user-facing infrastructure or dependencies.

### API Boundary *(mandatory for frontend features)*

- **NestJS Endpoints Used**: `GET /api/v1/documents?mindSpaceId=<mindSpaceId>` returns document records belonging to the requested owned MindSpace; `POST /api/v1/documents` accepts multipart form data containing one `file` and `mindSpaceId` and returns persisted document metadata when available. A displayable document record contains `id`, `mindSpaceId`, `fileName`, and `status`; timestamps may also be returned. Delete, get-one, retry, preview, and ingestion endpoints are excluded.
- **Authentication Context**: Requests use the existing authenticated session or access token. The current `mindSpaceId` is supplied where required; `userId` is never submitted by the frontend, and ownership is determined from authenticated context.
- **Excluded Direct Access**: The frontend does not directly access Agent, RAG, Qdrant, PostgreSQL, Supabase, object storage, or other internal services.

### Key Entities *(include if feature involves data)*

- **Document**: An uploaded PDF belonging to one MindSpace, identified by a stable identifier and represented to the user by its original filename and backend-owned processing status.
- **Current MindSpace**: The authenticated user's selected workspace context; it determines which documents may be listed and where a PDF may be uploaded.
- **Selected File**: The single local PDF chosen for a potential upload; it is temporary, is not shared globally, and is cleared when its MindSpace context changes or its upload succeeds.
- **Processing Status**: The backend-owned current state of a document, such as processing, ready, or failed; the Documents area displays but does not calculate or control it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated user with a valid MindSpace can open Documents and identify every listed document's filename and processing status without assistance.
- **SC-002**: A document-list request always results in one clear loading, success, empty, or safe error state.
- **SC-003**: Users can select and submit one valid PDF in no more than three interactions after opening the upload controls, excluding file-system navigation.
- **SC-004**: Across all acceptance tests, missing or invalid file submissions produce zero upload requests, and repeated submissions during an active upload produce no duplicate upload requests.
- **SC-005**: When upload returns complete document metadata, the new document appears in the current list without a page reload.
- **SC-006**: In 100% of tested MindSpace changes, prior document lists and upload state disappear before the new context is shown, and late prior-context results make no visible change.
- **SC-007**: All planned document-list and upload tasks can be completed with keyboard-only interaction in English LTR and Arabic RTL at representative desktop and mobile widths.
- **SC-008**: Network, service, and authorization failures expose no internal error or storage details and always leave the user with a clear next state, such as retry context or return to login.
- **SC-009**: Acceptance testing confirms that no out-of-scope document capability, direct internal-service access, global Documents state, or new dependency is introduced.

## Assumptions

- Existing authentication, logout, locale direction, and current MindSpace selection remain available and authoritative.
- The application backend enforces authentication, MindSpace ownership, actual PDF content validation, persistence, and processing status ownership.
- The required document-list operation is provided through the existing application backend boundary and returns records filtered to the requested MindSpace.
- A filename ending in `.pdf`, combined with no explicit non-PDF browser type, is sufficient for pre-request validation; the backend remains authoritative because browser metadata alone cannot prove file contents.
- Known processing statuses include `PROCESSING`, `READY`, and `FAILED`; the backend may add statuses later, and unfamiliar values remain displayable.
- The backend's default document ordering is acceptable; user-controlled sorting and filtering are out of scope.
- The expected number of documents can be displayed without complex pagination for this release.
- Processing status is shown as returned when the list loads or after upload; automatic polling is not required.
