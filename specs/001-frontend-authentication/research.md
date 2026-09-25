# Research: Frontend Authentication

## Decision: Use Existing NestJS Login Contract Only

Rationale: The backend currently exposes an auth login endpoint that accepts email and password and returns `user` plus `accessToken`. The frontend can satisfy this feature by using that contract directly.

Alternatives considered: Adding refresh/session discovery, registration, current-user checks, or a new auth mechanism. Rejected because the spec asks for a small auth flow and forbids inventing backend behavior.

## Decision: Keep Auth State Storage Compatible With NestJS Contract

Rationale: Store the access token using the simplest browser-side mechanism compatible with the existing NestJS authentication contract. Keep authentication state simple and easy to replace later if the backend contract changes.

Alternatives considered: Refresh-token handling, session infrastructure, auth frameworks, and additional state-management architecture. Rejected because they add moving parts and speculate beyond the current feature.

## Decision: Client-Side Protected Route Guard

Rationale: Auth state is browser-side for this feature, so a small client guard is the simplest route protection approach.

Alternatives considered: Middleware or server-side auth checks. Rejected because they require cookie/server-readable auth state that the current backend contract does not provide for this feature.

## Decision: No Auth Framework Or Global State Library

Rationale: The feature needs one login flow, one protected landing page, and logout by clearing frontend state. Built-in React and Next.js capabilities are sufficient.

Alternatives considered: NextAuth/Auth.js, Redux, Zustand, or custom provider stacks. Rejected because they add moving parts without a current need.

## Decision: Minimal i18n And RTL Integration

Rationale: `next-intl` is the project standard. Labels, validation, loading text, and errors should come from English and Arabic message files. Direction should be handled at the locale layout level.

Alternatives considered: Hard-coded strings or per-component direction logic. Rejected because they either break translation requirements or spread direction handling unnecessarily.

## Decision: Behavior-Focused Tests Only

Rationale: Use existing frontend test tooling only. If no frontend test tooling exists, do not introduce a new test framework in this feature. Keep testing limited to existing project capabilities.

Alternatives considered: Testing every helper and implementation detail. Rejected because it would add maintenance cost without improving confidence for this small feature.
