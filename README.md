# CoderLife Form Builder and Manager

A reusable form engine for visually designing forms, publishing immutable definitions, collecting and editing records, and reviewing historical changes.

Status: implementation baseline in progress (internal candidate `0.1.0`, unpublished).

This repository now contains a runnable monorepo with core contracts, a PostgreSQL-backed service baseline, React packages, two example hosts, and local infrastructure scripts.

Scope is still in active delivery. Not every requirement from `docs/prompts/first-working-version.md` is complete yet. See sprint evidence for exact pass/partial/fail items.

The React packages now target the exact published `0.2.0-alpha.0` UI pair. See [UI integration](docs/ui-integration.md) for tracking, accessibility and verification.

## Quick start

1. Install dependencies:

```bash
npm ci
```

1. Start local infrastructure:

```bash
npm run dev:infra
```

Uploads default to private filesystem storage. Configure optional S3-compatible storage via `.env` values described in `docs/file-storage.md`.

1. Build packages/apps:

```bash
npm run build
```

1. Run migrations and seed (host port is `55432`):

```bash
FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:migrate
FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:seed
```

1. Run tests:

```bash
npm test
```

Normal tests use fixtures/mocks and do not start or use a database. For SQL/API
integration, create a dedicated test database once and run explicitly:

```bash
FORM_TEST_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder_test npm run test:integration
```

This connects to an already-running test database; it does not start Docker.
Never use the application or production database for this command.

1. Build packed artifacts and verify consumer fixture:

```bash
npm run pack:artifacts
npm run verify:consumer
```

1. Stop local infrastructure:

```bash
npm run dev:infra:down
```

## Workspace layout

- `packages/form-core`: schemas, stable IDs, normalization, rule helpers.
- `packages/form-postgres`: migrations and repository implementation.
- `packages/form-server`: Express HTTP adapter and policy/source extension points.
- `packages/form-react`: renderer/history components baseline.
- `packages/form-builder`: manager/builder components baseline.
- `apps/example-minimal`: minimal host integration example.
- `apps/example-workspace`: workspace/project-oriented host example.
- `fixtures/consumer-smoke`: packed-artifact fixture checks.

## Intended developer experience

Install the supported packages, configure a database, run provided migrations, connect trusted identity and permission checks, mount the backend and React interfaces, and use the complete form lifecycle. Consumers retain ownership of their data and deployments.

The baseline currently provides:

- core schema validation and stable identity utilities,
- form draft/publish persistence in PostgreSQL,
- server-side idempotency storage and replay checks,
- initial renderer and builder/manager package APIs,
- two buildable host examples.

Authentication remains host-controlled; server authorization is mandatory.

## Product scope

- Visual grid builder with drag-and-drop and equivalent keyboard controls.
- Per-field labels, help text, information tooltips, initial values, validation, and responsive layout.
- Builder-configured conditions for visibility, requiredness, read-only and disabled states.
- Host-registered value sources, option sources, validators, and lifecycle hooks.
- Single and multiple file uploads through a defined storage integration.
- Drafts, preview, explicit publication, immutable versions, and separate record revisions.
- Capture, editing, read-only display, and historically accurate views.
- Builder-only duplication, JSON definition export, and independent-copy import.
- Provided database migrations and upgrade guidance.
- WCAG 2.2 AA target and public documentation on CoderLifeNet.

TrackForge Atlas is a motivating consumer, not the owner of this project's domain model. A ready-made form repository is outside current scope.

## Documentation

Start with the [documentation index](docs/README.md).

- [Product requirements](docs/product-requirements.md)
- [Proposed architecture and data lifecycle](docs/architecture.md)
- [Decision log](docs/decisions.md)
- [Roadmap and delivery criteria](docs/roadmap.md)
- [Versioning and releases](docs/versioning.md)
- [Integration and public documentation plan](docs/integration.md)
- [File storage adapters and setup](docs/file-storage.md)
- [Sprint plan](docs/sprints/first-working-version.md)
- [Sprint evidence report](docs/sprints/first-working-version-report.md)

## Development and contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Work is now in implementation mode for this repository only, under the boundaries defined in the sprint prompt and repository instructions.

Major versions are owner-controlled. Remain on `0.x.x` until Chris explicitly approves `1.0.0`; neither commit messages nor automation may authorize that transition.

## License

A license has not been selected. Public visibility is not an open-source license grant. Select a license before package publication or outside code contributions.
