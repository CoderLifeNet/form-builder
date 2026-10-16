# Package publishing playbook

This repository prepares a first public delivery for one package:

- @coderlifenet/form-builder

Root workspace, examples, fixtures, and internal support packages remain private and are not published.

License is approved as MIT. Keep publication approval and execution separate from license approval.

## Current release candidate

- Candidate package: `@coderlifenet/form-builder@0.1.0-alpha.0`
- Candidate source branch: `feat/ui-0.2-integration`
- Candidate artifact path: `tmp/packs/coderlifenet-form-builder-0.1.0-alpha.0.tgz`

## Workflow contract

Workflow: `.github/workflows/publish.yml`

- Trigger mode: `workflow_dispatch` only.
- Required input: `expected_sha` (exact `main` commit approved for release).
- Mode input: `prepare` (default), `publish-bootstrap`, `publish-oidc`.

Guardrails enforced by automation:

- Workflow fails unless ref is exactly `refs/heads/main`.
- Workflow fails unless `expected_sha` equals `${{ github.sha }}`.
- Validation and publish run in separate jobs.
- Publish job runs only for `publish-bootstrap` or `publish-oidc`.
- Validated tarball identity is recorded at `artifacts/release.json` (filename + sha256 + sha512 integrity + source commit).
- Publish job downloads the uploaded artifact and must pass exact identity verification before any publish attempt.
- Publish job runs in environment `npm-alpha`; bootstrap token is scoped to that environment and only read in bootstrap mode.

## Trusted publisher setup

Configure npm trusted publishing for @coderlifenet/form-builder:

1. Open package settings in npm.
2. Add a trusted publisher using GitHub Actions OIDC.
3. Scope repository to CoderLifeNet/form-builder.
4. Restrict workflow file to .github/workflows/publish.yml.
5. Restrict branch/environment according to release policy (`main` + `npm-alpha` environment).

OIDC trusted publishing and provenance require workflow permissions `id-token: write`.

Important npm constraints (verified from npm documentation):

- Trusted publishing currently supports GitHub Actions on GitHub-hosted runners.
- Trusted publishing requires npm CLI `11.5.1+` and Node `22.14.0+`.
- A newly created trusted publisher configuration must complete its first successful publish within 2 days or it expires.

## Bootstrap-token setup (first publish path)

When the package has not yet been published from this repository identity, use one controlled bootstrap run:

1. Create GitHub environment `npm-alpha` in this repository.
2. Add environment secret `NPM_BOOTSTRAP_TOKEN` (token value never committed or printed).
3. Run workflow with `mode=publish-bootstrap` and `expected_sha=<approved-main-commit>`.
4. Confirm npm lists the package/version/tag and preserve run logs as release evidence.
5. Remove or rotate bootstrap token after first successful trusted setup transition.

Use `publish-bootstrap` only when OIDC trusted publishing is not yet active for this package.

## OIDC publish path (steady state)

After trusted publisher mapping is active in npm for this package:

1. Run workflow with `mode=publish-oidc` and exact `expected_sha`.
2. Publish job requests OIDC token (`id-token: write`) and publishes with provenance.
3. No bootstrap token is used or required in this mode.

## Preparation-only path

Use `mode=prepare` for non-publishing validation:

- Runs build/typecheck/pack/consumer verification.
- Runs release policy checks and npm dry-run publication validation.
- Uploads tarball + `artifacts/release.json` for immutable evidence.
- Does not run publish job.

Workflow compatibility details:

- Node is pinned to `22.22.3`.
- npm is upgraded in-workflow to `11.11.1` before `npm ci` so trusted publishing requirements are met.

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
2. Run workflow on `main` with `mode=prepare` and `expected_sha` set to the exact approved commit.
3. First publication path only: run `mode=publish-bootstrap` after confirming `npm-alpha` environment and `NPM_BOOTSTRAP_TOKEN` are configured.
4. Configure/verify npm trusted publisher for `.github/workflows/publish.yml` and repository identity.
5. Subsequent publications: run `mode=publish-oidc` with exact `expected_sha`.
