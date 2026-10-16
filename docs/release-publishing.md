# Package publishing playbook

This repository prepares a first public delivery for one package:

- @coderlifenet/form-builder

Root workspace, examples, fixtures, and internal support packages remain private and are not published.

License is approved as MIT. Keep publication approval and execution separate from license approval.

## Current release candidate

- Candidate package: `@coderlifenet/form-builder@0.1.0-alpha.0`
- Candidate source branch: `feat/ui-0.2-integration`
- Candidate artifact path: `tmp/packs/coderlifenet-form-builder-0.1.0-alpha.0.tgz`

## First package registration on npm

Use this path one time for the package name before relying on trusted publishing automation:

1. Confirm @coderlifenet/form-builder is available (or verify ownership if already created).
2. Run local validation and artifact checks: `npm run typecheck`, `npm run build`, `npm run pack:artifacts`, `npm run verify:consumer`.
3. Perform one intentional publication from an authorized maintainer identity.
4. Confirm the package appears on npm with dist-tag alpha.

After this first registration, use the workflow-driven trusted publisher flow.

Notes:

- Do not create or store new automation credentials for this bootstrap step.
- The bootstrap publish is a maintainer-authorized action; trusted publishing is configured after the package exists in npm package settings.

## Trusted publisher setup

Configure npm trusted publishing for @coderlifenet/form-builder:

1. Open package settings in npm.
2. Add a trusted publisher using GitHub Actions OIDC.
3. Scope repository to CoderLifeNet/form-builder.
4. Restrict workflow file to .github/workflows/publish.yml.
5. Restrict branch/environment according to release policy.

OIDC trusted publishing and provenance require workflow permissions `id-token: write`.

Important npm constraints (verified from npm documentation):

- Trusted publishing currently supports GitHub Actions on GitHub-hosted runners.
- Trusted publishing requires npm CLI `11.5.1+` and Node `22.14.0+`.
- A newly created trusted publisher configuration must complete its first successful publish within 2 days or it expires.

## Manual workflow behavior

Workflow: .github/workflows/publish.yml

- Trigger mode: `workflow_dispatch` only.
- Default behavior: validate + dry-run publish preparation.
- Real publish requires explicit input `publish=true`.
- No automatic releases, no automatic version bumps.

Workflow compatibility details:

- Node is pinned to `22.22.3`.
- npm is upgraded in-workflow to `11.5.1` before `npm ci` so trusted publishing requirements are met.

Workflow availability note:

- `workflow_dispatch` can only be triggered when `.github/workflows/publish.yml` exists on the default branch.

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
3. Confirm `fixtures/consumer-smoke` validates all documented subpath exports (`builder`, `renderer`, `core`, `server`, `postgres`), TypeScript types, browser/server separation for renderer imports, host theme/analytics composition, and backend mount health.

## Publication sequence after approval

1. Merge the release-candidate branch chain so `publish.yml` is present on default branch.
2. Verify workflow dispatch dry-run (`publish=false`) from the commit intended for publication.
3. For the first package publication, execute one maintainer-authorized bootstrap publish.
4. Configure npm trusted publisher for `.github/workflows/publish.yml`.
5. For subsequent releases, use workflow OIDC publishing (`publish=true`) only.
