# Repository instructions

## Current authorization

This repository is in discovery and design. Documentation and repository setup are authorized. Do not implement runtime code, install dependencies, publish packages, build consumers, or modify other repositories without explicit authorization.

Read README.md and the relevant docs before changes. Preserve the difference between approved requirements and proposed implementation choices.

## Product boundaries

- Generic reusable engine; do not hardcode TrackForge, workspace, project, or company models.
- Keep contracts and validation independent of React/MUI/storage.
- Use verified CoderLife UI exports for the default React interface; inspect exports and peer compatibility before planning dependencies. Use one compatible provider/theme arrangement.
- Form definitions must not embed arbitrary JavaScript, unrestricted HTML, secrets, or unsafe expressions.
- Server validation and authorization are authoritative.
- Published definitions are immutable; each record revision references its exact definition.
- Never silently migrate records, overwrite saved values with defaults, or erase history.
- Preserve host-controlled retention and authorized erasure.

## Versions and releases

Read docs/versioning.md. Never choose a major bump automatically. Chris must explicitly approve 1.0.0 and every subsequent major. Remain on 0.x.x during early development. No per-commit version bumps, automatic npm publication, or tags/releases during documentation setup.
Breaking changes during 0.x require a deliberate minor release and migration guidance, not an automatic major.

## Delivery

Organize work into coherent deliverables, not individual text/style edits. Identify frontend, service, persistence, migration, documentation, and consumer impacts. Do not edit another repository merely because a dependency is relevant.
Track implementation, testing, and human review separately. Never mark a proposal implemented or reviewed without evidence.
Run relevant checks once appropriate to the change; no runtime test claims while no runtime exists.
