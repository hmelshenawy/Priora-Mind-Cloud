# Research: Tasks Frontend

## Decision: Use The Existing List And Create Contracts Directly

Rationale: NestJS already provides authenticated, ownership-checked list and create operations with raw task responses. One Tasks-specific API module matches the established Notes/Documents pattern and requires no backend work.

Alternatives considered: A Next.js proxy, generic client, repository, service layer, or backend redesign. Rejected because each adds architecture without solving a current requirement.

## Decision: Integrate Tasks Into The Existing App Shell

Rationale: Notes, Documents, and Chat are sections under `/{locale}/app`, not feature-specific routes. Passing the selected `mindSpaceId` from `AppShell` preserves the existing routing and ownership-aware selection model.

Alternatives considered: A `/tasks` page, route-managed selection, or independent Tasks selector. Rejected because these conflict with the current shell convention and could create a second source of MindSpace truth.

## Decision: Keep Tasks State Local

Rationale: Only the Tasks section consumes its list, form, validation, and request state. Component-local state is sufficient and follows the constitution and existing frontend features.

Alternatives considered: Context, provider, global store, persisted task cache, or a custom data hook. Rejected because there is no current cross-component consumer or demonstrated reuse.

## Decision: Preserve The Raw Backend List Order

Rationale: The service returns tasks ordered by `updatedAt` descending, and the feature explicitly forbids unnecessary client sorting. Rendering the array in response order keeps NestJS authoritative.

Alternatives considered: Sorting by creation date, title, executor, or status in the browser. Rejected because it changes backend-defined behavior and adds unsupported controls.

## Decision: Show The Create Response Then Revalidate The List

Rationale: Create returns the persisted task with identity, MindSpace, metadata, and timestamps. Incorporating that record immediately satisfies no-reload behavior without manufacturing fields, while one background list request fulfills the explicit post-create revalidation requirement and refreshes backend collection/order.

Alternatives considered: Full-page reload, speculative local task construction, only local insertion, or waiting for revalidation before showing success. Rejected because they add disruption, invent data, omit the specified revalidation, or delay visible success.

## Decision: De-Duplicate Create Results By ID Without Re-Sorting

Rationale: The backend can return a matching task created within the prior two minutes. If its ID already exists, replacing it in place avoids duplicates and avoids moving an older deduplicated task to the top; a genuinely new ID is prepended.

Alternatives considered: Always prepend, always append, or ignore existing IDs. Rejected because these can duplicate records, violate current order, or discard an authoritative response.

## Decision: Invalidate Older Lists And Let Revalidation Replace The List

Rationale: Accepted creation invalidates an older list before inserting the returned record. The subsequent successful revalidation can then replace local records with the backend response in backend order. If revalidation fails, retaining the accepted record and current list preserves visible create success without permanently retaining records that a successful backend response omitted.

Alternatives considered: Merging every local record absent from the response, waiting to show creation until revalidation, or adding a server-state library. Rejected because broad merging can retain stale records, waiting delays accepted success, and a library is disproportionate.

## Decision: Reject Stale Data Results And Scope 401 By Authentication Session

Rationale: MindSpace switching can race with list, create, and non-authentication failures. Separate counters plus a current-MindSpace reference prevent prior-context data changes. A 401 concerns the shared authentication session rather than one MindSpace, but an old request must compare its captured token with current auth state so it cannot clear a newly established session.

Alternatives considered: Accepting every data completion, making 401 MindSpace-local, processing a 401 after its session has been replaced, AbortController infrastructure, or a query library. Rejected as unsafe, inconsistent with session-wide authentication, or unnecessarily complex for two operations.

## Decision: Validate Only The Non-Whitespace Title And Controlled Executor

Rationale: Backend DTO validation occurs before service trimming, so whitespace-only titles can otherwise become empty persisted values. Trimming the title, omitting a blank description, and selecting only `USER` or `AGENT` provide immediate feedback without duplicating broader backend rules.

Alternatives considered: Relying entirely on the backend, adding arbitrary lengths, or adding a schema library. Rejected because the title gap is known, while additional rules or dependencies have no product basis.

## Decision: Treat Status And Executor As Backend-Owned Metadata

Rationale: Actual statuses are `PENDING`, `PROGRESS`, `COMPLETED`, and `CANCELLED`; executors are `USER` and `AGENT`. Translating known values while safely displaying unfamiliar strings supports evolution without inference. `AGENT` is metadata only.

Alternatives considered: Using historical `IN_PROGRESS`, deriving status from UI activity, hiding unknown values, or calling Agent for `AGENT`. Rejected because each conflicts with the running backend contract or feature scope.

## Decision: Reuse Existing Authentication And Safe Error Behavior

Rationale: Existing features read the session token, send bearer auth, clear auth and MindSpace selection on a current-session 401, and redirect to locale login. Contract-specific safe errors avoid exposing backend internals.

Alternatives considered: Sending `userId`, showing raw response bodies, adding an auth provider, or treating authentication validity as MindSpace-local. Rejected for security and consistency reasons.

## Decision: Reuse Existing EN/AR And Accessibility Conventions

Rationale: The locale layout already supplies language and direction. Native labeled controls, semantic lists, live status text, logical CSS, and locale-aware dates match established Notes/Documents behavior.

Alternatives considered: Component-managed direction, a date library, or a new design system. Rejected because existing capabilities cover the requirement.

## Decision: Validate With Existing Frontend Tooling

Rationale: The frontend has typecheck and production build scripts but no unit or browser test framework. Those automated checks plus focused browser scenarios are consistent with prior frontend specs and avoid adding broad infrastructure for one feature.

Alternatives considered: Adding a unit/component/e2e framework or backend tests. Rejected because no frontend baseline exists and the backend contract is unchanged.
