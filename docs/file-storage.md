# File storage and Garage reference setup

Updated October 11, 2026. Approved direction: the engine is storage-agnostic; Garage is the optional supplied object-storage reference deployment. Local filesystem support is the minimal additional adapter for traditional host-server uploads, included in the revised first-release scope. Implementation and provider testing remain unverified by this documentation update.

## Separate persistence from file storage

The reference database stores form definitions, publication versions, records, revisions, bindings, permissions-related associations and upload metadata. File bytes belong in a configured storage adapter, not inside definitions or exported form JSON.
Forms with no file fields require no file-storage provider. The renderer and core cannot depend on Garage, AWS, MinIO or LocalStack.

## Supported first-release paths

| Path | Consumer setup |
| --- | --- |
| Local filesystem adapter | Configure a server-owned private directory, persistent disk and engine upload/download routes. No object-storage container needed. |
| S3-compatible adapter | Configure private endpoint/bucket/region/credentials and supported request behavior. |
| Garage reference | Optional Docker Compose profile using a pinned official Garage image and tested configuration. |
| Custom adapter | Implement the documented provider-neutral contract and run its conformance tests. |

S3-compatible is not a promise of every AWS S3 feature. Test the operations the engine uses against Garage. Other named providers are not certified as working until tested. MinIO and LocalStack are not mandatory product/runtime infrastructure.
Supply Compose/configuration/scripts rather than inventing a proprietary Garage image or requiring a hosted CoderLife service.

## Upload contract

Provide streamed writes, verification/completion, authorized reads/downloads, metadata/stat, cancellation and deletion/cleanup through provider-neutral operations. Direct presigned upload/download is an optional adapter capability, not required for traditional uploads.
The engine owns validation, trusted tenant/owner association, attachment authorization, upload state, record linkage, idempotency, expiration and retention rules. The adapter owns byte storage and provider mechanics; it does not replace engine authorization.

Use stable opaque file identities in saved values. Server-private metadata resolves each file to its provider/object location; do not store signed URLs, bucket credentials or absolute filesystem paths in form definitions or portable exports. Changing the default adapter does not relocate existing files: retain routing for prior provider IDs, or perform a separately planned and verified transfer.

Database commits and file writes do not share a transaction. Model pending/verified/attached/deletion-pending states and compensating cleanup. Do not report erasure complete while deletion failed. Historical revisions keep valid file references subject to authorized retention/erasure.

## Filesystem requirements

Generate storage keys; do not use supplied filenames as paths. Prevent traversal, symlink escape and tenant path collisions; enforce private root ownership. Stream with size limits, stage files before completion, use atomic finalization where supported, and keep directories out of public static hosting.
Preserve original filenames only as protected display metadata. Authorize every engine download; use safe content disposition. Document persistence, backups and the shared-volume requirement for multiple server instances.

## Garage delivery

Provide pinned image, configuration, persistent data/metadata volumes, bucket/key initialization, readiness checks, endpoint configuration and server-only secrets. Initialization must be repeatable without resetting buckets/keys/data.
Keep Garage administration endpoints/private credentials away from respondent clients. Use the S3 adapter; no special Garage concepts in the form schema.

Publish guides for filesystem-only setup, Garage setup, bring-your-own S3-compatible service and custom adapters. Clearly separate a single-node development deployment from a resilient production deployment, including backups, TLS and capacity management.

Official reference documents:
- https://garagehq.deuxfleurs.fr/documentation/quick-start/
- https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/

Verify official image/version/configuration and supported operations during implementation. Do not assume upstream quick-start defaults provide persistence or production redundancy.

## Acceptance

Run the upload lifecycle suite against both filesystem and actual Garage, through the same API/renderer contract: single/multiple files, validation, progress, retry/cancel, permission isolation, restart persistence, historical references and deletion/orphan cleanup.
The filesystem example must run without Garage/S3/LocalStack. No-file examples must run without a configured storage adapter.
Core/browser packages must not eagerly require a storage SDK. Preserve database/provider separation in packed-package tests and document which combinations were actually tested.
