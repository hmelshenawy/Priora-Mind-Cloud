# T018 — Retrieve PDF and Extract Text

## Phase
Phase 8 — Knowledge / RAG Service

## Goal
Implement the first real ingestion step in the RAG service:

```text
document metadata
→ retrieve PDF from object storage
→ extract text
```

This ticket stops at extracted text. Do not implement chunking, embeddings, Qdrant, or semantic search yet.

## Scope

Add the minimal functionality needed for the RAG service to:

- receive a document reference
- retrieve the PDF from Supabase Storage
- validate that a file was retrieved
- extract text from the PDF
- return extracted text
- keep the implementation small and direct

## Expected Input

The RAG service should receive enough information to locate the stored document.

For V1, use:

```json
{
  "storageKey": "users/<userId>/mindspaces/<mindSpaceId>/documents/<uuid>.pdf"
}
```

Do not send the PDF bytes through NestJS in this ticket.

Do not query PostgreSQL directly from the RAG service.

## API

### POST /extract

Request:

```json
{
  "storageKey": "users/<userId>/mindspaces/<mindSpaceId>/documents/<uuid>.pdf"
}
```

Response example:

```json
{
  "text": "Extracted PDF text..."
}
```

The exact response may include small useful metadata such as page count if the PDF library provides it naturally, but keep it minimal.

## Flow

```text
POST /extract
    ↓
validate storageKey
    ↓
Supabase Storage
    ↓
download PDF bytes
    ↓
PDF text extraction
    ↓
return extracted text
```

## Supabase Storage

Add only the configuration required for this ticket:

```env
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SUPABASE_STORAGE_BUCKET=files
```

Use the existing Supabase backend secret key.

Do not expose secrets in logs or responses.

Create the Supabase client directly. Do not introduce a storage interface, adapter, provider abstraction, factory, or repository.

## PDF Extraction

Use one simple Python PDF library that can extract text from normal text-based PDFs.

Choose a lightweight library appropriate for this task.

Requirements:

- accept downloaded PDF bytes
- extract text in page order
- combine page text into one string
- handle pages with no extractable text without crashing

OCR is out of scope.

Scanned/image-only PDFs may return little or no text in V1.

## Suggested Structure

Keep the existing package:

```text
src/
└── ragcore/
    ├── __init__.py
    ├── main.py
    ├── config.py
    ├── storage.py
    └── pdf.py
```

This is only a suggestion.

Use fewer files if the code remains clearer.

Do not create classes unless they provide a clear current benefit.

## Error Handling

Return an appropriate HTTP error when:

- `storageKey` is missing or empty
- Supabase download fails
- the object does not exist
- the downloaded file cannot be processed as a PDF
- PDF extraction fails

Do not return raw provider errors or secrets to the client.

## Security / Architecture Rules

The RAG service:

```text
CAN:
- access Supabase Storage
- process document bytes

CANNOT:
- access PostgreSQL directly
- decide document ownership
- trust arbitrary user ownership claims
```

Ownership remains the responsibility of NestJS.

The intended future caller is:

```text
NestJS
→ validates document ownership
→ sends trusted storageKey
→ RAG Service
```

Authentication/service-to-service protection is out of scope for this ticket and will be handled later during integration.

## Acceptance Criteria

- `POST /extract` exists.
- It accepts a `storageKey`.
- It downloads the matching object from the configured Supabase bucket.
- It extracts text from a valid text-based PDF.
- It returns extracted text successfully.
- Missing/nonexistent files fail cleanly.
- Invalid PDFs fail cleanly.
- Image-only pages do not crash the service.
- Supabase configuration comes from environment variables.
- Secrets are not logged.
- No PostgreSQL access is introduced.
- No chunking, embeddings, Qdrant, or retrieval logic is implemented.
- Relevant checks/tests pass.

## Out of Scope

Do NOT implement:

- text chunking
- text cleaning pipeline beyond trivial joining
- embeddings
- embedding model loading
- Qdrant
- vector storage
- `/ingest`
- `/search`
- semantic retrieval
- document status updates
- PostgreSQL access
- NestJS integration code
- Agent integration
- OCR
- image extraction
- background jobs
- queues
- retries framework
- generic storage abstractions
- repositories
- factories
- unnecessary interfaces/base classes

## Implementation Rules

- Keep it simple.
- Use direct functions where possible.
- Avoid premature abstractions.
- Do not create generic provider architecture.
- Do not create helpers unless they improve readability or are reused.
- Keep source files small and focused.
- Follow the existing `ragcore` package structure.

## Validation

Before completing the ticket:

1. Start the RAG service.
2. Upload/use a real PDF already stored in the `files` bucket.
3. Call `POST /ingest` using its `storageKey`.
4. Confirm extracted text is returned.
5. Test a missing/nonexistent `storageKey`.
6. Test an invalid/non-PDF object.
7. Run relevant lint/type/test checks.

## Completion Report

When finished, report:

1. Files created.
2. Files modified.
3. Dependencies added.
4. What was implemented.
5. Validation results.
6. Any deviation from the ticket and why.
