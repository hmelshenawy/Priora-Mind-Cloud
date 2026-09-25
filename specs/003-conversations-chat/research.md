# Research: Conversations and Chat

## Decision: Follow Four Existing NestJS Contracts Directly

Rationale: The backend already provides list/create conversation and list/send message endpoints with ownership checks. A contract-specific frontend module can call them directly using the existing API base URL and bearer token.

Alternatives considered: A generic client, repository, adapter, Next.js API proxy, or backend change. Rejected because the current frontend uses direct NestJS fetch and the feature needs only four endpoints.

## Decision: Use The Existing `minspaceId` Query Key

Rationale: The current controller reads `query.minspaceId`. The frontend must match this exact contract even though the spelling differs from `mindSpaceId` used in request bodies.

Alternatives considered: Sending a corrected query key or normalizing through an adapter. Rejected because that would not match the current backend and no adapter is needed.

## Decision: Keep All Chat State Local

Rationale: Only the Chat component consumes conversations, active conversation, messages, inputs, and request states. Passing the current MindSpace ID from `AppShell` is sufficient.

Alternatives considered: Context, provider, global state library, or persistent chat state. Rejected because there is no current cross-screen need.

## Decision: Reload Messages After Send

Rationale: NestJS returns the Agent reply `{role, content}` after persisting both messages, but does not return both persisted message records with IDs and timestamps. Reloading the ordered message history is simpler and authoritative.

Alternatives considered: Optimistically adding temporary user/assistant records with rollback or merging the reply into cached history. Rejected because it creates speculative synchronization and identity problems.

## Decision: Guard Against Stale Results With Local Request Identity

Rationale: A request counter/ref or effect cleanup flag is sufficient to ignore responses started for an old MindSpace or conversation.

Alternatives considered: Cancellation frameworks, query libraries, or global synchronization. Rejected as unnecessary for this small UI.

## Decision: Use Existing Validation Capabilities

Rationale: Trim conversation title and message content before request. Enforce the backend's three-character title minimum and non-empty message rule in the UI while retaining NestJS as authoritative.

Alternatives considered: Schema validation libraries. Rejected because existing language/browser capabilities are sufficient.

## Decision: Validate With Existing Tooling

Rationale: The frontend has typecheck and build scripts but no test framework. Use those scripts and manual user-flow validation without adding dependencies.

Alternatives considered: Adding a test runner for this feature. Rejected by project constraints.
