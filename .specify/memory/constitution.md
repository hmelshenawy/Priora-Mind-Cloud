<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Template principle 1 -> I. Simple Design First
- Template principle 2 -> II. Readability and Focused Code
- Template principle 3 -> III. Frontend API Boundary
- Template principle 4 -> IV. User States, Accessibility, and Internationalization
- Template principle 5 -> V. Minimal Dependencies and Evidence-Based Complexity
Added sections:
- Frontend Constraints
- Development Standards
Removed sections:
- None
Templates requiring updates:
- updated .specify/templates/plan-template.md
- updated .specify/templates/spec-template.md
- updated .specify/templates/tasks-template.md
- not present .specify/templates/commands/*.md
Follow-up TODOs:
- None
-->
# Priora MindCloud Frontend Constitution

## Core Principles

### I. Simple Design First

The frontend MUST use the simplest implementation that clearly satisfies the current
requirement. Code MUST NOT introduce abstractions, layers, factories, generic
frameworks, reusable infrastructure, global state, caching, memoization,
virtualization, or design patterns without a clear current need. A possible future
requirement is not a valid reason to add complexity now.

Rationale: Priora MindCloud is intentionally small; fewer moving parts make the
frontend easier to understand, debug, refactor, and maintain.

### II. Readability and Focused Code

Code MUST be explicit, straightforward, and easy for another developer to read.
Files, variables, functions, components, hooks, and types MUST use clear names.
Each module, component, hook, and function MUST have one clear responsibility.
Large components MUST NOT mix unrelated API calls, UI rendering, transformation
logic, and state management. Source files SHOULD remain below 300 lines; when a
file approaches that size, split it only when there is a logical responsibility
boundary.

Rationale: readable, focused code is safer to change than clever or highly
abstract code.

### III. Frontend API Boundary

The frontend MUST communicate only with the NestJS backend. It MUST NOT call the
Python Agent service, RAG service, Qdrant, PostgreSQL, Supabase, object storage,
or any other internal implementation detail directly. The backend is the source
of truth for business rules, authorization, ownership, and persistence. Frontend
code MUST follow existing backend API contracts exactly, MUST NOT send `userId`
manually when authentication context identifies the user, and MUST NOT duplicate
backend authorization or ownership rules.

Rationale: the required runtime boundary is User -> Next.js Frontend -> NestJS
Backend -> Agent / RAG / Database / Storage. Keeping this boundary strict
protects security, ownership, and maintainability.

### IV. User States, Accessibility, and Internationalization

Every data-driven feature MUST define loading, empty, success, and error states.
Failed requests MUST be visible and understandable to the user; failures MUST NOT
be silently ignored. UI MUST use semantic HTML, keyboard-accessible interactive
elements, and labeled inputs. Pages and components MUST work on desktop and
mobile. English LTR and Arabic RTL experiences MUST be supported correctly using
`next-intl` conventions.

Rationale: the product must be usable, understandable, and accessible in both
supported languages under normal and failure conditions.

### V. Minimal Dependencies and Evidence-Based Complexity

Dependencies MUST remain minimal. Built-in React, Next.js, TypeScript, and
browser capabilities MUST be preferred when they solve the problem clearly. New
libraries MUST provide a clear current benefit. TypeScript types MUST reflect the
real NestJS request and response contracts and MUST NOT become an overly complex
generic type system. Important user flows and critical behavior MUST be tested;
tests MUST protect behavior rather than trivial implementation details.

Rationale: dependencies, complex types, and excessive tests all add maintenance
cost; they are justified only when they reduce current risk or complexity.

## Frontend Constraints

The frontend stack is Next.js 16 with the App Router, TypeScript, React, and
`next-intl` for English and Arabic. Specifications, plans, tasks, and
implementations MUST keep the folder structure shallow and predictable, organizing
by feature only when it improves clarity. Folders containing one trivial file MUST
NOT be created unless there is a clear reason.

Components MUST remain small and focused. Shared or generic components MUST be
created only after a real repeated use case appears or when extraction clearly
improves readability. UI components MUST NOT contain backend business rules.
Complex data fetching or transformation logic MUST be separated from large
presentation components when needed.

State management MUST default to local component state. Server data returned by
NestJS MUST be treated as the source of truth. Global state management libraries
MUST NOT be added unless multiple unrelated parts of the application demonstrate
a current need. Server state MUST NOT be duplicated unnecessarily.

Performance work MUST start with correct and readable code. Advanced performance
techniques, including caching, memoization, virtualization, and custom loading
strategies, MUST be added only when there is evidence they are needed.

## Development Standards

Specifications MUST state the NestJS API contract used by a frontend feature and
MUST explicitly exclude direct access to internal services or storage. Plans MUST
pass a Constitution Check before implementation by confirming simplicity,
frontend API boundary compliance, user states, accessibility, responsive design,
English/Arabic directionality, dependency impact, and testing scope.

Tasks MUST be small enough to complete and verify independently. They MUST include
behavior-focused tests for important flows and critical behavior, but MUST NOT add
excessive tests for trivial implementation details. Refactoring tasks MUST
simplify the code; working simple code MUST NOT be refactored into a more
abstract design unless there is a real maintainability problem.

When choosing between two valid implementations, contributors MUST prefer the one
with fewer moving parts, clearer control flow, fewer dependencies, lower coupling,
easier debugging, and easier future change. If the simple solution works clearly,
it MUST NOT be replaced with a more abstract one. A future possibility is not a
current requirement.

## Governance

This constitution supersedes conflicting frontend implementation guidance in
specifications, plans, tasks, and reviews. All new frontend specifications and
implementation plans MUST include a Constitution Check against these principles.
Any intentional violation MUST be documented with the current need, the simpler
alternative considered, and the reason the simpler alternative is insufficient.

Amendments MUST update this file and any affected templates or runtime guidance in
the same change. Versioning follows semantic versioning: MAJOR for incompatible
governance or principle removals/redefinitions, MINOR for added or materially
expanded principles or sections, and PATCH for clarifications or non-semantic
wording changes. Compliance MUST be reviewed during planning and again before a
feature is considered complete.

**Version**: 1.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25
