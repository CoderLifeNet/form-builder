# Versioning and release policy

## Owner-controlled progression

Use major.minor.patch versions. Current repository baseline is 0.0.0; no release or npm package exists.

- Stay on 0.x.x during early development.
- Chris must explicitly approve 1.0.0 and every subsequent major release.
- Never infer major approval from breaking changes, commit messages, dependency tools, completed features, or elapsed time.
- No automatic major bumps, tagging, GitHub releases or npm publication.
- Version releases, not individual commits or development sessions.

## Pre-1.0 rules

| Change | Default release treatment |
| --- | --- |
| Compatible fixes, documentation and small refinements | Patch |
| Coherent capability milestone or incompatible public-contract/schema change | Deliberate minor |
| Transition to stable public contract | Explicit owner-approved 1.0.0 |

Examples: 0.0.1 → 0.0.2 for fixes; 0.1.0 → 0.2.0 for a selected capability milestone. Hundreds of commits do not imply hundreds of release bumps.
Pre-1.0 breaking changes require prominent release notes, compatibility impact and migration/upgrade guidance. They do not trigger 1.0.0 automatically.
Group changes into releases; do not jump minor versions to mirror feature counts.
Use alpha/beta/rc suffixes only when prerelease distribution is introduced and approved.

## After 1.0

Compatible fixes are patches and backward-compatible features are minors. Breaking changes require a proposed major and explicit owner approval. If approval is pending, do not ship an incompatible change as a minor.

## Separate version domains

Package release versions, export/schema format versions, database migration identifiers, published form versions and record revision numbers are distinct.
Changing a form does not bump the npm package. Package changes do not reinterpret old definitions.
An explicit compatibility matrix must relate package releases to supported database/export formats. Cross-package lockstep versus independent versions is undecided.

## Migration obligations

Provide versioned initial and upgrade migrations. Never edit an already-released migration; add a follow-up.
Host operators run migrations deliberately. Imports/startup must not silently alter databases.
Document supported starting versions, prerequisites, backups, data transformations, rollback limitations and recovery from failure.
Test fresh installation and upgrades from supported prior schemas. Destructive changes require explicit operational guidance and authorization.
Preserve historical meaning across schema upgrades subject to retention/erasure.

## Release checklist

1. Select a coherent release scope and proposed version.
2. Record compatibility and breaking changes.
3. Verify code, security, accessibility and migrations appropriate to the scope.
4. Update changelog, VERSION, package metadata (when present), examples and public docs.
5. Obtain owner approval for release/publication and explicit approval for any major.
6. Tag vX.Y.Z and publish only through the authorized release process.

Future automation must reject major changes without recorded owner approval and must not derive versions solely from conventional commits.
