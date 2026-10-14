# CoderLife Form Builder and Manager

A reusable form engine for visually designing forms, publishing immutable definitions, collecting and editing records, and reviewing historical changes.

Status: implementation baseline in progress with first public package preparation for `@coderlifenet/form-builder@0.1.0-alpha.0` (not yet published).

This repository now contains a runnable monorepo with one public artifact (`@coderlifenet/form-builder`) and internal support modules for core contracts, renderer, server, and PostgreSQL integration.

Scope is still in active delivery. Not every requirement from `docs/prompts/first-working-version.md` is complete yet. See sprint evidence for exact pass/partial/fail items.

The public package targets the exact published `0.2.0-alpha.0` UI pair through host-owned runtime integration. See [UI integration](docs/ui-integration.md) for tracking, accessibility and verification.

## Quick start

1. Install dependencies:

```bash
npm ci
```

1. Start workspace example locally with one command:

```bash
npm run dev
```

This command checks prerequisites, starts Docker PostgreSQL, waits for readiness,
builds required package artifacts, runs migrations on the dedicated local development
database, and starts backend + workspace frontend with matching API URLs.

1. Start the minimal example with one command:

```bash
npm run dev:minimal
```

1. Optional first-time demo seed (explicit only):

```bash
FORM_DB_URL=postgres://formbuilder:formbuilder@127.0.0.1:55432/formbuilder npm run db:seed
```

By default startup preserves existing local database and uploads.
It does not reset volumes, drop data, or reseed automatically.

1. Stop local processes with `Ctrl+C` in the running dev command terminal.

Use `npm run dev:infra:down` only when you intentionally want to stop Docker services.

1. Run tests:

```bash
npm test
```

Normal tests use fixtures/mocks and do not start or use a database. For SQL/API
integration, create a dedicated test database once and run explicitly:

```bash
FORM_TEST_DB_URL=postgres://formbuilder:formbuilder@127.0.0.1:55432/formbuilder_test npm run test:integration
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

- `packages/form-builder`: public package with subpath exports:
	- `@coderlifenet/form-builder/builder`
	- `@coderlifenet/form-builder/renderer`
	- `@coderlifenet/form-builder/core`
	- `@coderlifenet/form-builder/server`
	- `@coderlifenet/form-builder/postgres`
- `packages/form-core`, `packages/form-react`, `packages/form-server`, `packages/form-postgres`: internal support modules used to assemble the public artifact.
- `apps/example-minimal`: minimal host integration example.
- `apps/example-workspace`: workspace/project-oriented host example.
- `fixtures/consumer-smoke`: packed-artifact fixture checks.

## Intended developer experience

Install the single public package, configure a database, run provided migrations, connect trusted identity and permission checks, mount the backend and React interfaces, and use the complete form lifecycle. Consumers retain ownership of their data and deployments.

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

TrackForge Atlas is a motivating consumer, not the owner of this project's domain model. Keep TrackForge-specific guidance in [docs/trackforge-integration.md](docs/trackforge-integration.md); keep generic host integration in shared docs.

## Documentation

Start with the [documentation index](docs/README.md).

- [Product requirements](docs/product-requirements.md)
- [Proposed architecture and data lifecycle](docs/architecture.md)
- [Decision log](docs/decisions.md)
- [Roadmap and delivery criteria](docs/roadmap.md)
- [Versioning and releases](docs/versioning.md)
- [Release publishing playbook](docs/release-publishing.md)
- [Integration and public documentation plan](docs/integration.md)
- [File storage adapters and setup](docs/file-storage.md)
- [Minimal example walkthrough](apps/example-minimal/README.md)
- [Workspace/project example walkthrough](apps/example-workspace/README.md)
- [Sprint plan](docs/sprints/first-working-version.md)
- [Sprint evidence report](docs/sprints/first-working-version-report.md)

## Development and contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Work is now in implementation mode for this repository only, under the boundaries defined in the sprint prompt and repository instructions.

Major versions are owner-controlled. Remain on `0.x.x` until Chris explicitly approves `1.0.0`; neither commit messages nor automation may authorize that transition.

## License

A license has not been selected. Public visibility is not an open-source license grant. Select a license before package publication or outside code contributions.
