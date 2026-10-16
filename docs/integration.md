# Integration and public documentation plan

This is a plan, not an installation guide. No packages or commands are available yet.

## Default consumer path

1. Install the released packages.
2. Configure the supported database and run provided migrations.
3. Register trusted identity, tenant context and permissions.
4. Register optional field sources, programmatic conditions and validators.
5. Configure upload storage when using file fields.
6. Mount the service API and React interfaces with the verified provider/theme setup.
7. Design, publish, collect, reopen, edit and review records.

The reference path must work end to end. Consumers should not reimplement persistence, field error mapping, versioning, record history, concurrency or idempotency.

## Responsibility split

| Engine | Host application |
| --- | --- |
| Definition/record contracts and service implementation | Deployment and database/storage connections |
| Server validation and authorization enforcement points | Trusted identity, tenant scope and permission decisions |
| Builder/renderer/history interfaces | Placement and compatible application theme |
| Source registry and lifecycle contracts | Registered data sources and business rules |
| Initial/upgrade migrations | Deliberate migration execution and backups |
| Safe errors and observable lifecycle | Operational logging policy without sensitive values |
| Upload lifecycle contracts/reference adapter | Storage credentials, retention and deployment controls |

## Public documentation on CoderLifeNet

Provide quick start, supported compatibility matrix, database setup/upgrades, backend mounting, React/provider configuration, intelligent fields/source registration, files, permissions/public forms, lifecycle/errors, history/migration, duplication/import/export, API reference and troubleshooting.
Document ownership, encryption, key management and deployment responsibilities without unsupported compliance claims.
npm READMEs link to full guides and show a tested minimal integration.
Each release includes updated examples, migration notes and breaking-change guidance.

## Verification

A fresh consumer must complete the guide without inventing missing infrastructure or implementing engine internals.
Test the reference path against documented package/database versions, including saved forms, failed requests, file permissions and upgrades.
Publishing documentation to coderlife.net is a later explicit work package; this repository setup does not modify that site.

## Current lifecycle behavior (first working version)

The current implementation keeps one form identity with one mutable draft row and immutable published versions.

1. Create form: starts as an unpublished draft (`hasUnpublishedChanges=true`, no published version).
2. Publish draft: allowed only when unpublished changes exist; unchanged republish is rejected (`NO_UNPUBLISHED_CHANGES`).
3. Publish idempotency: publish retries can use `idempotency-key` replay for safe duplicate-submit handling.
4. Duplicate form: duplicates from latest published definition when available, otherwise from current draft.
5. Draft cleanup:
	- Never-published forms can delete draft+form identity (`DELETE /api/forms/:formId/draft`).
	- Published forms can discard only unpublished draft changes (`POST /api/forms/:formId/discard-unpublished`).
6. Archive behavior: archived forms reject new submissions/publish requests while version/record history remains readable.

Reference UI state labels now map to server lifecycle state instead of draft-row existence:

- unpublished draft
- published with unpublished changes
- published with no unpublished changes
- archived

## File storage choices

See [file storage](file-storage.md). Offer filesystem-only server uploads, optional Garage Docker setup, bring-your-own S3-compatible storage and custom-adapter examples. Object storage is not a requirement for all consumers. Publish actual tested provider/API compatibility and persistence/backup guidance.
