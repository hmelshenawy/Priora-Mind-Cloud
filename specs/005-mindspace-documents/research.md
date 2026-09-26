# Research: Documents

## Decision: Treat The Missing List Contract As A Required Backend Addition

Rationale: The checked-in `DocumentsController` exposes only upload and delete, and `DocumentsService` has no list method. A frontend call to `GET /api/v1/documents` would currently receive route-not-found, so the list acceptance criteria cannot be met frontend-only. The smallest correction is one guarded controller method and one ownership-checked service query in the existing Documents module.

Alternatives considered: Pretending the design-document endpoint already exists, omitting the list, calling Prisma or storage from the frontend, or introducing another service. Rejected because each is inaccurate, incomplete, violates the frontend boundary, or adds unnecessary architecture.

## Decision: Return A Raw Safe-Metadata Array From The New List Operation

Rationale: Existing Notes and Tasks list operations return raw arrays. Selecting `id`, `mindSpaceId`, `fileName`, `status`, `createdAt`, and `updatedAt` gives the UI its exact needs without exposing `storageKey`. Ordering by `createdAt` descending provides deterministic newest-first behavior. No envelope or mapping layer is needed.

Alternatives considered: A `{count, result}` envelope, raw records including `storageKey`, pagination, or a response adapter. Rejected because none is required and envelopes/adapters would be invented.

## Decision: Follow The Existing Upload Contract Without Changing Its Shape

Rationale: Actual upload is `POST /api/v1/documents` with multipart `file` and `mindSpaceId`, and returns `{result, documentMetaData}`. The nested `documentMetaData` includes every display field, while `result` and `storageKey` are internal values the UI does not need. The API function will return the network payload unchanged; the component will inspect the nested metadata only.

Alternatives considered: Flattening the response, changing upload to a direct record, wrapping it again, or constructing a local document from the selected file. Rejected because each departs from the actual contract or fabricates backend-owned data.

## Decision: Validate Complete Upload Metadata At The Use Site

Rationale: The feature explicitly defines behavior for incomplete upload metadata. A small runtime check for string `id`, `mindSpaceId`, `fileName`, and `status` before insertion handles untrusted network data without a normalization layer. The returned MindSpace must also match the request context.

Alternatives considered: Trusting a compile-time cast, manufacturing missing values, always reloading, or building a schema/adapter layer. Rejected because casts do not validate runtime data, fabrication violates backend authority, reload is not required, and another layer/dependency is excessive.

## Decision: Let The Browser Build Multipart Headers

Rationale: `FormData` with exact `mindSpaceId` and `file` field names matches `UploadFileDto` and `FileInterceptor("file")`. Omitting a manual `Content-Type` lets the browser provide the required multipart boundary.

Alternatives considered: JSON/base64 upload, manually setting multipart headers, direct storage upload, or a Next.js proxy. Rejected because they conflict with the actual controller contract or boundary.

## Decision: Keep PDF Pre-Validation Narrow

Rationale: Rejecting a missing file, a filename without a case-insensitive `.pdf` suffix, or an explicitly non-PDF browser MIME gives immediate feedback and sends no invalid request. An empty browser MIME remains acceptable for a `.pdf`; NestJS's `%PDF-` signature check remains authoritative.

Alternatives considered: Reading file bytes in the browser, accepting extension alone regardless of explicit MIME, adding a validation library, or inventing file-size limits. Rejected because backend content validation already exists and no size contract is defined.

## Decision: Keep Documents State Local And Reuse AppShell

Rationale: Only the Documents area consumes the list, selected file, and request states. `AppShell` already owns a valid selected MindSpace and renders protected features. Passing `mindSpaceId` directly and remounting with `key={selectedId}` follows the current Notes integration.

Alternatives considered: Context, provider, global store, persisted document state, a route-specific state layer, or a custom data hook. Rejected because no cross-component consumer or reuse exists.

## Decision: Reject Stale Results With Two Request Identities

Rationale: List and upload requests can complete after a MindSpace change. Separate counters plus a current-MindSpace ref allow every continuation to reject stale results, including stale errors and unauthorized responses, without cancellation infrastructure.

Alternatives considered: Abort-controller infrastructure, query libraries, global synchronization, or accepting last completion. Rejected as unnecessary or unsafe for this scope.

## Decision: Display Backend-Owned Status Verbatim Or By Known Translation

Rationale: The actual enum contains `PROCESSING`, `READY`, and `FAILED`. Known values can have translated labels; unknown values must remain visible instead of being inferred or hidden. Upload activity is not document-processing state.

Alternatives considered: Frontend state transitions, an `UPLOADED` status from older design documents, polling, or an `OTHER` replacement. Rejected because none matches the actual backend model.

## Decision: Reuse Existing Auth, Locale, Styling, And API Patterns

Rationale: Existing features read auth state locally, clear auth and MindSpace selection on current 401 responses, redirect to the locale login route, use a direct NestJS base URL, inherit `lang`/`dir`, and use logical responsive CSS. Documents can follow these patterns without shared infrastructure.

Alternatives considered: Auth provider, generic API client, locale/direction state, new page route, design system, or proxy. Rejected because each adds architecture absent from the existing app.

## Decision: Validate With Existing Tooling

Rationale: The backend already has Jest and build tooling, while the frontend has typecheck/build but no test framework. One focused backend service test plus frontend checks and manual behavior scenarios cover the changed contract and critical UI races without adding dependencies.

Alternatives considered: Adding frontend unit/e2e frameworks or relying only on manual backend testing. Rejected because a new framework violates constraints and the new list ownership behavior can use existing Jest.
