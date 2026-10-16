# Complete the first-working-version sprint

Continue development of CoderLifeNet/form-builder on the existing implementation branch. Plan and execute the remaining work; do not stop at another baseline or ask whether to start the next tranche.

## 1. Establish the current state and fetch the updated instructions

Inspect git status, branches, repository instructions, implementation, sprint plan and evidence report. Work on feat/first-working-engine if that remains the implementation branch; preserve existing developer changes. Do not start a duplicate implementation or rewrite commits merely to improve their appearance.

Fetch origin/main. Read its latest copies of:
- docs/prompts/continue-first-working-version.md
- docs/prompts/first-working-version.md
- docs/file-storage.md
- docs/design/ui-contract.md
- docs/design/form-studio-reference.html
- Related requirements, architecture, integration guide and decision log.

Before merging, inspect the diff. Reconcile these documentation changes into the implementation branch without discarding its code or truthful implementation-status updates. Use git show origin/main:<path> if necessary to read remote documents before reconciliation.

This invocation authorizes the remaining implementation, dependencies, local infrastructure, tests, working examples and documentation within this repository. It supersedes older discovery-only instructions. It does not authorize public deployment, npm publication, release tags, production database changes or changes to TrackForge/other repositories.

This continuation's clean-slate clarification overrides older instructions to preserve abandoned development storage or build compatibility paths for it. The original full sprint requirements and A01–A22 remain in scope except for the explicit pre-release upgrade clarification below.

## 2. Keep this unreleased project clean

There are no released installations or customer files/records to preserve. Do not introduce legacy provider routing, storage transfer tools, deprecated adapters, compatibility aliases or placeholder code for abandoned implementations.

Inspect and remove superseded MinIO/LocalStack infrastructure and references: Compose services, initialization scripts, package dependencies, environment settings, unused handlers, tests, README examples and documentation. Retain legitimate generic S3 support; an AWS SDK used by that adapter is not automatically an obsolete LocalStack dependency.

Reset/reseed only this project's clearly identified disposable development resources when needed. Do not delete unrelated containers, volumes, databases, files or credentials. Do not copy real credentials into documentation.

Consolidate unreleased prototype schema migrations where appropriate. Keep a genuine migration runner, ledger/status, locking and a tested fresh installation. Do not invent meaningless upgrade migrations for discarded prototypes. Released migration immutability applies once migrations are actually released.

## 3. Implement the corrected file-storage architecture

The form engine is provider-neutral. Form definitions, records, revisions and attachment metadata use the reference database; file bytes use a configured adapter.

Deliver:
- A private local filesystem adapter for traditional server uploads.
- An S3-compatible adapter with configurable endpoint/bucket/region/credentials.
- An optional Garage Docker Compose reference setup using a verified, pinned official image.
- A documented custom-adapter contract with meaningful conformance tests.

No-file forms must work without any upload storage configured. Filesystem mode must work without Garage, S3 or another object-store container. Core/browser packages must not depend on Garage configuration or eagerly load server storage SDKs.

The engine owns validation, trusted ownership, attachment permissions, upload lifecycle, record associations, idempotency and cleanup policy. Adapters handle byte operations and provider mechanics.

Use stable opaque file references. Keep credentials, signed URLs, bucket locations and absolute local paths out of form definitions and portable exports. Do not implement storage switching/migration features that this first release does not need.

Filesystem storage must use generated keys, private directories, streaming limits and safe finalization, with traversal/symlink protection and authorized download routes. Never expose uploads through an unrestricted public static directory.

Garage setup needs persistent volumes, configuration, repeatable initialization, readiness checks, server-only secrets and tested S3 behavior. A running container alone does not prove upload compatibility. Document development versus production deployment responsibilities.

## 4. Reassess every acceptance result against actual code

Read docs/sprints/first-working-version.md and first-working-version-report.md. Inspect the implementation behind each A01–A22 result rather than trusting a previous pass label.

Create coherent dependency-ordered tasks for all failed, partial, missing or unverified outcomes. Do not limit this continuation to the seven IDs highlighted previously. Include frontend, service/API, database/migration, tests, examples and docs responsibilities where applicable.

Keep the original acceptance criteria intact except: A19 now requires a working migration foundation, a clean fresh schema setup and tests for ledger/locking/repeatability/failure behavior. Exercise a genuine upgrade only where a meaningful retained earlier schema exists; otherwise mark upgrade-from-a-released-version not applicable before the first release. Do not use this clarification to skip migration tooling or historical integrity.

## 5. Complete the required product behavior

Finish all required scope from the original sprint prompt, including:
- Persisted manager/builder, accessible grid editing and independent field settings.
- Tooltips, blur validation, API field errors and truthful save/recovery states.
- Builder-configurable sources, conditions and read-only/disabled/required/visible states.
- Safe custom validation, dynamic value/option loading and protected host values.
- Immutable publication, exact-version historical rendering and record editing.
- Definition/record comparisons and explicit validated record migration.
- Generic workspace/project bindings, inheritance/override/reset, pinned/latest versions.
- Compact capture without bypassing requiredness.
- Independent duplication and import/export with fresh identity/reference remapping.
- Replacement import preserving history and deliberate dependency reconciliation.
- Real single/multiple uploads, access control, retry/cancel and cleanup.
- Archive/restore and authorized retention/erasure.
- Real runnable host examples and external packed-package consumer verification.

Do not replace these with TODOs, mocked routes, canned records or UI-only controls. Prototype simulation controls are not production fields/features. Use icon-only secondary actions with accessible names and hover/focus/tap tooltips; the Import tooltip is simply “Import.” Keep primary actions labeled where helpful.

## 6. Verify identity and authorization

The reported HTTP tests used x-tenant-id/x-actor-id. Inspect that implementation: these headers cannot establish production identity merely because the client supplies them.

Use trusted host context and explicit server policy; deny absent authorization. Remove insecure bypasses from normal operation. If a development-only mechanism remains, make it explicitly opt-in and isolated from production, and document it honestly. The working host example should demonstrate login/session-derived context and real membership checks.

Test forged IDs/headers, outsider and cross-tenant requests, changed permissions, replayed requests and file access. Frontend filtering is not authorization.

## 7. Preserve engine history, not abandoned infrastructure

Clean-slate development does not remove product history requirements. A record revision must retain its exact published definition, historical labels/options/values and authorized file references.

Default edits use the assigned version. Changes to requiredness, fields, types, options or parent defaults must not silently reinterpret old records. Explicit migration creates a new revision after preview/validation. Import replacement does not guess mappings by labels.

## 8. Validate the complete system

Run meaningful core/service tests, real PostgreSQL integration, actual filesystem and Garage upload lifecycle tests, browser end-to-end checks, accessibility/keyboard/focus/responsive checks and packed-package installation.

Verify restart persistence, permission isolation, server errors, concurrency, lost-response idempotency, source cancellation/stale results, imports, history, erasure and cleanup. Fix failures; do not weaken requirements or substitute mocks for the reference integration.

Execute the minimal and workspace/project setup guides as written. Record exact commands/results. Local infrastructure substitutions must meet the intended adapter contract, not silently reduce product functionality.

## 9. Align documentation and versioning

Update requirements, architecture, decisions, task plan/report, README/package READMEs, environment examples and public-documentation content to match the tested implementation.

Explain filesystem-only, optional Garage, bring-your-own S3 and custom-adapter setup. Cover host identity/permissions, workspace/project bindings, sources/hooks, capture/edit/history, migrations and troubleshooting with working examples. Prepare CoderLifeNet documentation without modifying/publishing the site.

Remain on 0.x.x; no automatic major bumps, tags, npm publishing or public deployment. Do not bump versions per task. License selection and human review remain owner-controlled; they do not justify stopping independent local development.

## 10. Finish with evidence

Commit coherent work on the existing branch without rewriting the baseline just for cosmetic history. Produce an updated report mapping every A01–A22 criterion to evidence, with the pre-release A19 clarification stated explicitly.

Report what works, exact startup/test commands, package artifacts/consumer proof, remaining external blockers and human-review needs. Do not claim full completion with partial required outcomes.

If an external dependency blocks work, investigate reasonable alternatives within scope and continue independent tasks. Distinguish implemented-but-unverified from tested. Do not fabricate a pass or ask whether to continue ordinary authorized work.

Begin with inspection/fetch/reconciliation, update the task plan, then carry out the remaining sprint.
