# Research: MindSpace App Shell

## Decision: Follow The Existing MindSpaces Response Exactly

Rationale: The authenticated NestJS `GET /api/v1/mindspaces` endpoint owns the response contract. Implementation must inspect and match that actual shape, typing only the fields consumed by the shell without adding a normalization adapter.

Alternatives considered: Inventing a new envelope, adding an adapter solely to normalize the response, or changing the backend. Rejected because the frontend must follow the existing contract and no backend change is needed.

## Decision: Reuse Direct Authenticated Fetch

Rationale: The frontend login already uses direct `fetch` with `NEXT_PUBLIC_NEST_API_BASE_URL`, and auth state exposes the access token. A single `getMindSpaces` function can use the same base URL and send `Authorization: Bearer <token>` as required by the NestJS JWT strategy.

Alternatives considered: A Next.js API proxy, generic API client, adapter, repository, or service layer. Rejected because none exists and one endpoint does not justify new infrastructure.

## Decision: Keep MindSpaces In Local Component State

Rationale: Only the app shell consumes the list and selected item in this feature. Local state keeps ownership clear and avoids global architecture.

Alternatives considered: Context providers, Redux, Zustand, or server-state libraries. Rejected because there is no demonstrated cross-feature need.

## Decision: Persist Only The Selected ID

Rationale: Store the selected ID in `sessionStorage`, matching the existing auth-state lifetime. The backend response remains the source of truth, and each load validates the ID against the latest list.

Alternatives considered: Persisting the full MindSpace object risks stale duplicated server data. Long-lived storage or backend persistence adds behavior outside this feature.

## Decision: First Available MindSpace Is The Fallback

Rationale: The specification explicitly permits the first returned item when no valid selection exists. This handles first load, one-item lists, and stale selections with one deterministic rule.

Alternatives considered: Prompting before selection or leaving selection empty despite available data. Rejected because both add unnecessary interaction or ambiguous context.

## Decision: Validate With Existing Project Capabilities

Rationale: The frontend currently provides typecheck and build scripts but no test framework. Use those scripts plus manual scenarios and do not add testing dependencies.

Alternatives considered: Adding a test runner solely for this feature. Rejected by the approved constraints.
