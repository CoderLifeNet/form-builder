# @coderlifenet/form-builder

Single public package for form definition authoring, rendering, server APIs, and PostgreSQL persistence.

## Install

```bash
npm install @coderlifenet/form-builder@0.1.0-alpha.0 react react-dom @coderlifenet/ui-core@0.2.0-alpha.0 @coderlifenet/ui-components@0.2.0-alpha.0
```

The package exports browser and server integrations via subpaths.

## Public exports

- `@coderlifenet/form-builder/builder`
	- `FormManager`, `FormBuilder`, `exportDefinition`, `importDefinition`
- `@coderlifenet/form-builder/renderer`
	- `FormRenderer`, `RecordHistoryView`, `createFormApiClient`, `createHttpUploadHandler`, `createMutationRetryKey`, `FormRequestError`
- `@coderlifenet/form-builder/core`
	- schema/contracts helpers (`validateDefinition`, stable IDs, comparison utilities, rule helpers)
- `@coderlifenet/form-builder/server`
	- `createFormServer`, policy/source extension points, upload/storage integration hooks
- `@coderlifenet/form-builder/postgres`
	- `FormRepository`, `MigrationRunner`, `makePool`, migration/seed support

## Browser and server separation

- Browser code should import only `builder`, `renderer`, or `core` subpaths.
- Node backend code should import `server` and `postgres` subpaths.
- Core contracts stay independent of React, UI libraries, PostgreSQL, or Express.

## Host-owned runtime requirements

- Keep one host-owned `UIExtensionsProvider` and analytics runtime at the app boundary.
- Keep host-owned theme wiring (`ThemeProvider`) outside embedded forms/builders.
- Do not wrap individual builders/renderers with isolated analytics/theme stacks.

## Typical integration flows

### Builder with autosave/manual save

Use `FormBuilder` with `onSaveDraft`, `onPublish`, `onSaved`, `onReloadDraft`, and `autosaveDelay`.

### Publication and version discovery

Use `createFormApiClient` against backend routes to publish drafts, list versions, and fetch exact published versions.

### Capture/edit/read-only/history

- Blank capture: `FormRenderer` with `mode="new"`.
- Saved-record editing: `FormRenderer` with `mode="edit"` and persisted values.
- Standalone read-only rendering: `FormRenderer` with `mode="read_only"`.
- Structural history: `RecordHistoryView` + exact definition lookup for historical revisions.

### Submission discovery and filtering

Use backend record-listing endpoints for paging and filters (`formId`, `createdBy`, date windows, query), then open records by ID for read/edit/history.

### Identity, permissions, and business associations

Use server `PolicyAdapter` to resolve host identity and enforce capability/resource checks.
Use record/form/resource-scoped authorization, and persist host-defined business associations through binding fields.

### Sources, conditional/protected fields, and field errors

Use `sourceResolver`/`optionSourceResolver` in renderer and source endpoints in server.
Conditionals and protected-field enforcement stay server-authoritative, with field-level API errors returned to clients.

### Uploads, historical access, retention, and migrations

- Use `createHttpUploadHandler` with upload policies.
- Enforce attachment authorization for current and historical revisions.
- Run retention/cleanup and migration flows from server/postgres integrations.

## Runnable examples in this repository

- `apps/example-minimal`: single-host baseline with builder, capture, upload, publish.
- `apps/example-workspace`: workspace/project flow with multiple submissions, discovery filters, revision history, and role-based behavior.

## Generic integration vs TrackForge guidance

Generic setup guidance belongs in repository `README.md` and docs under `docs/`.
TrackForge-specific notes remain isolated in `docs/trackforge-integration.md`.

## Extension/plugin boundary

Hosts can extend policy resolution, source resolution, storage, and analytics integration points.
This package does not implement DevHolm, GWJS, or other vendor-specific plugins.
