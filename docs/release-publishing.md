# Package publishing playbook

This repository prepares a first public delivery for one package:

- @coderlifenet/form-builder

Root workspace, examples, fixtures, and internal support packages remain private and are not published.

License status is intentionally pending Chris's explicit decision. Do not perform public publication until that decision is made.

## First package registration on npm

Use this path one time for the package name before relying on trusted publishing automation:

1. Confirm @coderlifenet/form-builder is available (or verify ownership if already created).
2. Run local validation and artifact checks:
	- npm run typecheck
	- npm run build
	- npm run pack:artifacts
	- npm run verify:consumer
3. Perform one intentional publication from an authorized maintainer identity.
4. Confirm the package appears on npm with dist-tag alpha.

After this first registration, use the workflow-driven trusted publisher flow.

## Trusted publisher setup

Configure npm trusted publishing for @coderlifenet/form-builder:

1. Open package settings in npm.
2. Add a trusted publisher using GitHub Actions OIDC.
3. Scope repository to CoderLifeNet/form-builder.
4. Restrict workflow file to .github/workflows/publish.yml.
5. Restrict branch/environment according to release policy.

OIDC trusted publishing and provenance require workflow permissions `id-token: write`.

## Manual workflow behavior

Workflow: .github/workflows/publish.yml

- Trigger mode: `workflow_dispatch` only.
- Default behavior: validate + dry-run publish preparation.
- Real publish requires explicit input `publish=true`.
- No automatic releases, no automatic version bumps.

## Dependency-order preparation

Although only one npm package is published, artifact assembly follows dependency order before tarball creation:

1. core contracts
2. PostgreSQL integration
3. server runtime
4. renderer
5. builder package assembly and subpath export rewrite

This ordering is enforced by the `@coderlifenet/form-builder` build script.

## Partial-release recovery

If publication is interrupted or fails:

1. Check npm for the exact published version/dist-tag state.
2. Fix the root cause (metadata/workflow/permissions/package contents).
3. Re-run workflow with the same version.
4. If the version already exists and cannot be overwritten, advance intentionally to the next approved prerelease and repeat validation.
5. Re-verify installation in an independent consumer before declaring completion.

## Independent registry-consumer check

Validate the public artifact independently before any publish attempt:

1. Run `npm run pack:artifacts`.
2. Run `npm run verify:consumer`.
3. Confirm `fixtures/consumer-smoke` validates:
	- all documented subpath exports (`builder`, `renderer`, `core`, `server`, `postgres`)
	- TypeScript types
	- browser/server separation for renderer imports
	- host theme/analytics composition
	- backend mount health.
