# CoderLife Form Builder and Manager

A reusable form engine for visually designing forms, publishing immutable definitions, collecting and editing records, and reviewing historical changes.

**Status: discovery and design.** Repository baseline: `0.0.0`. No npm package, runtime, migration, or release is available yet. Naming and package names are provisional.

## Intended developer experience

Install the supported packages, configure a database, run provided migrations, connect trusted identity and permission checks, mount the backend and React interfaces, and use the complete form lifecycle. Consumers retain ownership of their data and deployments.

The engine will provide form persistence, server validation, field error mapping, versioning, record history, concurrency handling, and integration contracts. Authentication is host-controlled; server authorization is mandatory.

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

## Development and contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Implementation begins only after its design and scope are explicitly authorized. There are currently no install, build, or runtime test commands.

Major versions are owner-controlled. Remain on `0.x.x` until Chris explicitly approves `1.0.0`; neither commit messages nor automation may authorize that transition.

## License

A license has not been selected. Public visibility is not an open-source license grant. Select a license before package publication or outside code contributions.
