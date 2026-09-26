# Research: Notes

## Decision: Follow The Three Existing NestJS Contracts Directly

Rationale: The backend already provides ownership-checked list, create, and get-one operations. A contract-specific frontend module can call them directly with the existing bearer token and API base URL convention. Responses are raw note arrays or records, not envelopes.

Alternatives considered: A generic client, repository, adapter, service layer, Next.js proxy, or backend changes. Rejected because the frontend already performs direct contract-specific fetches and Notes needs only three operations.

## Decision: Use The Exact `mindSpaceId` Query And Body Fields

Rationale: The list controller reads the case-sensitive `mindSpaceId` query key, while create accepts `{mindSpaceId, title, content}`. Following those contracts avoids invented normalization and sends no `userId`.

Alternatives considered: Reusing the Conversations `minspaceId` spelling, sending user context, or normalizing through an adapter. Rejected because each conflicts with the actual Notes contract or duplicates backend authentication.

## Decision: Load One Authoritative Note On Selection

Rationale: Although list responses currently contain full note records, the feature explicitly includes opening a note and the backend exposes an ownership-checked get-one endpoint. Calling it on explicit selection ensures the reading pane uses the current authoritative title/content.

Alternatives considered: Displaying list-record content only or prefetching all selected records. Rejected because list data may become stale and prefetching adds unnecessary traffic.

## Decision: Use The Create Response To Open A New Note

Rationale: Create returns the complete persisted note record after NestJS trims and stores it. Prepending and selecting that response immediately satisfies no-reload behavior without a redundant get-one request.

Alternatives considered: Reloading the list, calling get-one after create, or constructing a speculative local record. Rejected because the create response is already authoritative and includes identity and timestamps.

## Decision: Keep Notes State Local

Rationale: Only the Notes area consumes the list, selected note, form values, and request statuses. Passing `mindSpaceId` from `AppShell` is sufficient and mirrors the established Chat integration.

Alternatives considered: Context, provider, global store, persisted note state, or a custom data hook. Rejected because no current cross-screen consumer or reuse exists.

## Decision: Reject Stale Results With Request Identity

Rationale: MindSpace and selected-note changes can race with list, get-one, or create requests. Small counters plus current-context refs are enough to ignore late results without introducing cancellation or synchronization architecture.

Alternatives considered: Abort-controller infrastructure, query libraries, global synchronization, or accepting last completion. Rejected as unnecessary or unsafe for this scope.

## Decision: Validate Non-Whitespace Title And Content In The UI

Rationale: The DTO requires non-empty strings and the service trims before persistence, but whitespace-only strings can pass the DTO's pre-trim non-empty check. Trimming and rejecting empty values before requesting fulfills the feature requirement while NestJS remains authoritative.

Alternatives considered: Adding arbitrary minimum lengths, schema libraries, or changing the backend. Rejected because no stricter product rule is specified and existing language capabilities are sufficient.

## Decision: Reuse Existing Direct API Base URL And Auth Handling

Rationale: The frontend has no configured API rewrite or proxy. Existing modules use `NEXT_PUBLIC_NEST_API_BASE_URL` with a local `/api/v1` default, bearer auth, safe error classes, and locale-aware auth clearing/redirect behavior.

Alternatives considered: Adding a rewrite, proxy route, auth provider, or shared generic fetch wrapper. Rejected because each adds architecture not present or required.

## Decision: Validate With Existing Tooling

Rationale: The frontend provides TypeScript typechecking and production build scripts but no test framework. Those checks plus focused manual flows meet current project practice.

Alternatives considered: Adding a unit or browser test framework for this feature. Rejected by the existing-dependencies-only constraint.
