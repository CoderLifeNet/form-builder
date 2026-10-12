# File storage

Form Builder upload handling is provider-neutral with a filesystem default.

## Provider model

- `filesystem`: default and recommended for local development.
- `s3`: optional adapter for S3-compatible object storage.
- custom: hosts can inject their own `UploadStorageAdapter` implementation.

Server storage selection is controlled through environment variables:

- `FORM_UPLOAD_PROVIDER=filesystem|s3`
- `FORM_UPLOAD_DIR` for filesystem mode
- `FORM_S3_*` values for S3 mode

## Local filesystem mode

Set:

```bash
FORM_UPLOAD_PROVIDER=filesystem
FORM_UPLOAD_DIR=.form_uploads/private
```

The server writes uploads under a tenant-scoped directory and stores a stable `objectKey` in PostgreSQL.

## Optional S3-compatible mode

Set:

```bash
FORM_UPLOAD_PROVIDER=s3
FORM_S3_BUCKET=form-builder-dev
FORM_S3_REGION=us-east-1
FORM_S3_ENDPOINT=http://localhost:3900
FORM_S3_ACCESS_KEY=<access-key>
FORM_S3_SECRET_KEY=<secret-key>
FORM_S3_FORCE_PATH_STYLE=true
```

The built-in adapter uses `@aws-sdk/client-s3` (`PutObject`, `GetObject`, `DeleteObject`) and stores only metadata plus `objectKey` in PostgreSQL.

## Dev auth and upload endpoints

Upload endpoints require capability checks:

- `POST /api/forms/:formId/uploads`
- `GET /api/uploads/:uploadId/download`
- `DELETE /api/uploads/:uploadId`

Development session auth is opt-in (`FORM_DEV_AUTH=true`) and exposes `POST /dev/login` only in that mode.

## Custom adapter contract

A custom storage provider must implement:

- `storeObject({ tenantId, uploadId, fileName, contentType, stream })`
- `getObject({ tenantId, objectKey, contentType, sizeBytes })`
- `deleteObject({ tenantId, objectKey })`

See `packages/form-server/src/storage/types.ts` for the exact interface.
