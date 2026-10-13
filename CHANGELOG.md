# Changelog

## Unreleased

- Integrated the exact published 0.2.0-alpha.0 UI pair, scoped tracking/accessibility settings, serialized autosave, draft continuity, source refresh cancellation, independent-copy remapping, storage deletion retry bookkeeping, binding APIs and automated browser checks.
- Replaced tarball-existence checks with independent registry-backed installation, TSX compilation and runtime verification. Candidate remains internal 0.1.0; remaining acceptance gaps are listed in the sprint report.

- Implemented first-working-version baseline monorepo for `0.1.0` candidate (unpublished):
	- `@coderlifenet/form-core` contracts, schema validation, normalization, and definition comparison helpers.
	- `@coderlifenet/form-postgres` migrations, repository layer, idempotency persistence, and seed path.
	- `@coderlifenet/form-server` Express adapter with capability checks, draft/publish flows, record submission and idempotency handling.
	- `@coderlifenet/form-react` renderer/history baseline components.
	- `@coderlifenet/form-builder` manager/builder baseline components and import/export helpers.
	- `apps/example-minimal` and `apps/example-workspace` Vite examples.
	- Local infrastructure scripts (`docker-compose.yml`) using PostgreSQL with private filesystem uploads and optional host-configured S3-compatible storage.
	- Packed artifact workflow and consumer smoke verification fixture.

- Added sprint planning and evidence reports:
	- `docs/sprints/first-working-version.md`
	- `docs/sprints/first-working-version-report.md`

Not all acceptance criteria are complete yet. See `docs/sprints/first-working-version-report.md` for A01-A22 pass/partial/fail details and blockers.

No npm publication, release tag, or public deployment was performed.
