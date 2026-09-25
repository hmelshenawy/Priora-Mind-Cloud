# Contract: MindSpaces And App Shell

## NestJS Request

- Method: `GET`
- Path: `/api/v1/mindspaces`
- Authentication: existing bearer access token from frontend auth state
- Request body: none
- User identity parameter: none; NestJS derives user identity from authentication

## Existing NestJS Response

The frontend implementation must inspect and follow the actual response shape returned by the existing endpoint. It consumes only the MindSpace `id` and `name` needed by the shell and must not introduce a different envelope or an adapter solely for normalization.

## Shell Contract

- Protected route: `/{locale}/app`
- Loading: translated loading text while the request is active.
- Empty: translated no-MindSpaces message with no CRUD controls.
- Error: translated safe error without backend internals.
- Success: labeled selector and visible current MindSpace name.
- Logout: clear auth and MindSpace selection state, then redirect to `/{locale}/login`.
- Optional navigation placeholders: non-functional and no destination routes.

## Boundary Rules

- Frontend calls NestJS only.
- Frontend sends no `userId`.
- Frontend does not call Agent, RAG, Qdrant, PostgreSQL, Supabase, storage, or other internal services.
