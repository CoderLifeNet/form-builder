# Package publishing playbook

This repository supports a lockstep publication plan for these five packages only:

- @coderlifenet/form-core
- @coderlifenet/form-postgres
- @coderlifenet/form-server
- @coderlifenet/form-react
- @coderlifenet/form-builder

Root workspace and examples remain private and are never published.

License status is intentionally pending Chris's explicit decision. Do not publish publicly until that decision is made.

## First package registration on npm

Do this once per package name before relying on automated trusted publishing:

1. Confirm the package name is available on npm.
2. Run local validation and tarball preparation.
3. Perform one intentional first publication from an authorized maintainer identity.
4. Verify the package exists in the npm registry with dist-tag alpha.

After initial registration, use GitHub Actions trusted publishing for subsequent releases.

## Trusted publisher setup per package

Trusted publishing is configured per package on npm. Repeat for each of the five packages:

1. Open package settings in npm.
2. Add a trusted publisher entry for GitHub Actions.
3. Scope it to repository CoderLifeNet/form-builder.
4. Restrict workflow file to .github/workflows/publish.yml.
5. Restrict environment/branch according to your policy.

OIDC trusted publishing and provenance rely on repository permissions id-token: write.

## Publication order

Publish in dependency order to avoid transient 404 dependency resolution errors:

1. @coderlifenet/form-core
2. @coderlifenet/form-postgres
3. @coderlifenet/form-server
4. @coderlifenet/form-react
5. @coderlifenet/form-builder

The publish workflow follows this order for both dry-run and real publish.

## Partial-release recovery

If publication fails mid-sequence:

1. Identify the last successfully published package/version.
2. Fix the root cause in source or npm package settings.
3. Re-run publish workflow with the same release version.
4. Publish only missing packages in dependency order.
5. Confirm all five packages resolve with the same lockstep version before declaring release complete.

Do not bump versions only to recover from an interrupted publication unless required by npm immutability constraints.

## Independent registry-consumer check

Use a clean consumer environment to verify installability and runtime behavior from packed artifacts and registry-compatible versions:

1. Run npm run pack:artifacts.
2. Run npm run verify:consumer.
3. Confirm TypeScript and runtime checks pass in fixtures/consumer-smoke.

This validation is required before enabling publish=true in manual workflow dispatch.
