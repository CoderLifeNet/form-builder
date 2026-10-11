# Changelog

## Unreleased

- Implemented first-working-version baseline monorepo for `0.1.0` candidate (unpublished):
	- `@coderlifenet/form-core` contracts, schema validation, normalization, and definition comparison helpers.
	- `@coderlifenet/form-postgres` migrations, repository layer, idempotency persistence, and seed path.
	- `@coderlifenet/form-server` Express adapter with capability checks, draft/publish flows, record submission and idempotency handling.
	- `@coderlifenet/form-react` renderer/history baseline components.
	- `@coderlifenet/form-builder` manager/builder baseline components and import/export helpers.
	- `apps/example-minimal` and `apps/example-workspace` Vite examples.
	- Local infrastructure scripts (`docker-compose.yml`) using PostgreSQL and LocalStack S3-compatible storage.
	- Packed artifact workflow and consumer smoke verification fixture.

- Added sprint planning and evidence reports:
	- `docs/sprints/first-working-version.md`
	- `docs/sprints/first-working-version-report.md`

Not all acceptance criteria are complete yet. See `docs/sprints/first-working-version-report.md` for A01-A22 pass/partial/fail details and blockers.

No npm publication, release tag, or public deployment was performed.
