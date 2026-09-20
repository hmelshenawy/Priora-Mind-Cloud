# T016 — Implement Document Upload and Object Storage

## Goal

Implement document upload and object storage in the NestJS backend.

```text
User
 └── MindSpace
      └── Document
```

This ticket handles:

```text
HTTP file upload
→ MindSpace ownership check
→ object storage upload
→ Document metadata persistence
```

No RAG, embeddings, chunking, or Qdrant in this ticket.

## Phase

Phase 07 — Documents & Object Storage

## Dependencies

- T001–T015 completed.
- JWT authentication works.
- MindSpaces ownership protection works.
- Prisma `Document` model already exists.
- Object storage credentials/configuration are available.

## Existing Prisma Model

```prisma
model Document {
  id          String         @id @default(uuid())
  mindSpaceId String
  fileName    String
  storageKey  String
  status      DocumentStatus @default(PROCESSING)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  mindSpace MindSpace @relation(
    fields: [mindSpaceId],
    references: [id],
    onDelete: Cascade
  )

  @@index([mindSpaceId])
}

enum DocumentStatus {
  PROCESSING
  READY
  FAILED
}
```

Do not add `userId` to Document.

Ownership is:

```text
Document → MindSpace → User
```

## Module Structure

```text
src/documents/
├── documents.module.ts
├── documents.controller.ts
├── documents.service.ts
├── storage.service.ts
└── dto/
    └── create-document.dto.ts
```

Keep `StorageService` inside `DocumentsModule` for V1.

Do not create:

```text
StorageModule
StorageAdapter
StorageInterface
StorageFactory
S3Adapter
SupabaseAdapter
```

unless there is a real second storage implementation.

## API Design

```http
POST   /api/v1/documents
GET    /api/v1/documents?mindSpaceId=<uuid>
GET    /api/v1/documents/:id
DELETE /api/v1/documents/:id
```

No PATCH endpoint in V1.

## 1. Upload Document

### Endpoint

```http
POST /api/v1/documents
```

Use:

```http
Content-Type: multipart/form-data
```

Request fields:

```text
mindSpaceId → text
file        → File
```

Use NestJS:

```ts
@UseInterceptors(FileInterceptor('file'))
```

Conceptually:

```ts
@Post()
@UseInterceptors(FileInterceptor('file'))
upload(
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: CreateDocumentDto,
  @Req() req: { user: { userId: string } },
) {
  return this.documentsService.create(dto, file, req.user.userId);
}
```

### CreateDocumentDto

Validate only:

```text
mindSpaceId
- required
- UUID
```

Do not put file metadata manually in the DTO.

The server gets it from:

```text
file.originalname
file.mimetype
file.size
file.buffer
```

## Ownership Check

Before uploading:

```text
MindSpace.id = dto.mindSpaceId
AND
MindSpace.userId = current user
```

If not found/not owned:

```text
404 Not Found
```

Do not upload before ownership succeeds.

## File Validation

For V1 accept PDF only.

Validate:

```text
file exists
file.mimetype = application/pdf
```

Missing/unsupported file:

```text
400 Bad Request
```

Keep file validation simple.

## Storage Key

Generate a unique key. Do not use the original filename as the object key.

Recommended shape:

```text
users/{userId}/mindspaces/{mindSpaceId}/documents/{uuid}.pdf
```

Store:

```text
fileName   = file.originalname
storageKey = generated object key
```

## Upload Flow

```text
POST /documents
↓
JwtGuard
↓
req.user.userId
↓
multipart/form-data
├── mindSpaceId
└── file
↓
validate
↓
verify MindSpace ownership
↓
generate storageKey
↓
StorageService.upload(...)
↓
create Document row
↓
status = PROCESSING
↓
return Document
```

Use Prisma default `PROCESSING` when practical.

## Failure Behavior

If object storage upload fails:

```text
do not create Document row
```

If storage succeeds but DB create fails:

```text
attempt to delete uploaded object
rethrow the error
```

Keep this direct. Do not create a cross-system transaction abstraction.

## 2. List Documents

```http
GET /api/v1/documents?mindSpaceId=<uuid>
```

Use:

```ts
@Query('mindSpaceId', ParseUUIDPipe)
```

Verify MindSpace ownership first, then:

```ts
prisma.document.findMany({
  where: { mindSpaceId },
  orderBy: { createdAt: 'desc' },
});
```

## 3. Get One Document

```http
GET /api/v1/documents/:id
```

Use `ParseUUIDPipe`.

Verify:

```text
Document.id = id
AND
Document.mindSpace.userId = current user
```

Conceptually:

```ts
prisma.document.findFirst({
  where: {
    id,
    mindSpace: { userId },
  },
});
```

Return metadata only. No download endpoint yet.

## 4. Delete Document

```http
DELETE /api/v1/documents/:id
```

Use `ParseUUIDPipe`.

Flow:

```text
verify Document ownership
↓
StorageService.delete(document.storageKey)
↓
delete Document row from PostgreSQL
↓
return deleted Document
```

Cross-user/not-found:

```text
404 Not Found
```

No Qdrant cleanup yet because RAG is Phase 8.

## StorageService

Create one simple injectable service:

```ts
@Injectable()
export class StorageService {
  ){}
  async upload(file: Express.Multer.File, storageKey: string) {
    // object storage SDK call
  }

  async delete(storageKey: string) {
    // object storage SDK call
  }
}
```

Responsibilities:

```text
upload object
delete object
provider-specific SDK/configuration
```

Do not put ownership/business logic here.

## DocumentsService

Suggested methods:

```ts
create(dto, file, userId)
findAll(mindSpaceId, userId)
findOne(documentId, userId)
remove(documentId, userId)
```

Responsibilities:

```text
MindSpace ownership
Document ownership
storage key generation
StorageService orchestration
Prisma persistence
cleanup on partial create failure
```

## Module

```ts
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService],
})
export class DocumentsModule {}
```

Register `DocumentsModule` in the application module.

## Environment Configuration

Use `ConfigService`.

Do not hard-code:

```text
storage URL
bucket name
API key
secret
```

Use environment variables matching the selected provider and project conventions.

## Status Rule

New upload:

```text
PROCESSING
```

Do not set `READY` in Phase 7.

Later Phase 8:

```text
PROCESSING
↓
extract
↓
chunk
↓
embed
↓
store in vector DB
↓
READY
```

Failure later:

```text
FAILED
```

## Manual Tests

### Own Upload

User A uploads PDF to own MindSpace.

Expected:

```text
201
file stored
Document row created
status = PROCESSING
```

### Other User's MindSpace

Expected:

```text
404
file not uploaded
```

### Missing File

Expected:

```text
400
```

### Non-PDF

Expected:

```text
400
```

### List/Get

Only owned Documents are accessible.

### Delete

Expected:

```text
object removed
Document row removed
```

### Cross-user Delete

Expected:

```text
404
object untouched
```

## Implementation Principles

- Document belongs to MindSpace.
- No redundant `userId`.
- Use `multipart/form-data`.
- Use `FileInterceptor('file')`.
- PDF only in V1.
- Ownership before upload.
- Actual file goes to object storage.
- PostgreSQL stores metadata only.
- Original filename and storage key are separate.
- Generate unique storage keys.
- New status remains `PROCESSING`.
- Keep `StorageService` inside `DocumentsModule`.
- No StorageModule yet.
- No strategy/factory/interface for one provider.
- No RAG.
- No embeddings.
- No Qdrant.
- No Agent.
- No download endpoint yet.

## Acceptance Criteria

- `DocumentsModule` exists.
- `DocumentsController` exists.
- `DocumentsService` exists.
- `StorageService` exists inside Documents feature.
- `CreateDocumentDto` exists.
- Upload accepts multipart/form-data.
- File received with `FileInterceptor('file')`.
- `mindSpaceId` validated.
- JWT required.
- Ownership checked before upload.
- PDF accepted.
- Missing/unsupported files rejected.
- Unique storage key generated.
- File uploaded to object storage.
- PostgreSQL stores metadata only.
- New status = PROCESSING.
- List/get/delete enforce ownership.
- Delete removes storage object and DB row.
- Cross-user access returns 404.
- No RAG/vector logic added.
- TypeScript compiles.
- NestJS starts successfully.

## Out of Scope

- RAG ingestion
- PDF text extraction
- Chunking
- Embeddings
- Qdrant
- Semantic search
- Agent tools
- AI summaries
- Download/stream endpoint
- Signed URLs
- Rename
- Move between MindSpaces
- Multiple storage providers
- Image/audio files
- OCR
- Pagination
- Soft delete
