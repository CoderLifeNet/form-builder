# Sprint plan: first complete working version

Date: 2026-10-11
Branch: feat/first-working-engine
Prompt authority: docs/prompts/first-working-version.md

## Scope reconciliation

- Earlier repository docs marked this repository as discovery-only.
- This sprint prompt explicitly supersedes that stage and authorizes implementation in this repository only.
- Out of scope remains unchanged: npm publication, tags/releases, production deployment, changes to TrackForge or other repositories.
- Versioning policy remains in force: stay on 0.x.x; no automatic major.

## Delivery model

Status values:

- Proposed
- In progress
- Implemented
- Tested
- Human reviewed (always external to this automation)

Evidence location conventions:

- Code/tests: package/app folders
- Verification logs: docs/sprints/first-working-version-report.md
- Acceptance mapping: A01-A22 matrix in report

## Dependency-ordered task plan

| ID | Depends on | Coherent outcome | Frontend | Service/API | DB/Migrations | Testing | Docs | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | - | Workspace/tooling baseline with npm workspaces, TypeScript, lint/test/build scripts, Docker Compose infra, env templates | Shared config for apps/packages | Shared API typing/build setup | Postgres container and env templates for filesystem-first uploads plus optional S3-compatible provider | Tooling smoke checks | Setup docs draft | Tested | `package.json`, `docker-compose.yml`, `.env.example`, build/setup command logs |
| T02 | T01 | Core contracts and schemas: immutable definition model, stable IDs, field/rule/source schemas, normalization/comparison primitives | Shared types consumed by React | Shared validation used by server | N/A | Unit tests for schemas/rules/limits | Core package README | Tested | `packages/form-core`, core test output |
| T03 | T01,T02 | Postgres persistence and migrations: forms/drafts/published defs, records/revisions, bindings, uploads, idempotency, audit | N/A | Repository implementations | SQL migrations + migrate status/seed | Integration tests against real Postgres | Migration docs | Tested | `packages/form-postgres`, migrate/seed logs, integration test output |
| T04 | T02,T03 | Service and HTTP adapter: auth policy adapter, optimistic concurrency, idempotency behavior, error envelope, OpenAPI/client generation | API client contracts for React/example apps | Express routes + services | Uses T03 repositories transactionally | Service tests (conflict/idempotency/auth) | API docs + OpenAPI | Tested | `packages/form-server`, policy and upload endpoint tests |
| T05 | T03,T04 | Source/validator/hook registry and upload lifecycle with S3-compatible integration | UI loading/error states supported | Source/query/resolve/validate hooks | Upload metadata + lifecycle persistence | Integration tests with object storage and validation edge cases | Hook/storage docs | Tested | Upload create/download/delete routes and adapter contract implemented and runtime-verified; advanced lifecycle policy checks still pending |
| T06 | T02,T04,T05 | React renderer package for full/compact/new/edit/read-only/history and accessible error handling | Render/capture/history components | Consumes typed API client | N/A | Component/unit tests + E2E flows | Renderer docs | Partial | `packages/form-react` baseline implemented, no dedicated tests yet |
| T07 | T02,T04,T06 | React builder/manager package with palette/canvas/properties/preview/publish/duplicate/import/export/settings | Builder UI and keyboard alternatives | Uses server-backed draft/publish/import/export APIs | N/A | E2E authoring and portability tests | Builder docs | Tested | `packages/form-builder` now exercises drag-drop reorder, keyboard move/resize shortcuts, per-field property tabs, and save/publish status/error handling in live browser flows |
| T08 | T04,T05,T06,T07 | Reference apps: minimal integration and workspace/project host with policy boundaries and deterministic demo auth | Host shells and mounted reusable views | Example policy adapters and wiring | Uses real Postgres/object storage path | End-to-end flows across both examples | Example guides | Tested | `apps/example-minimal`, `apps/example-workspace`, build output and browser submit/history evidence |
| T09 | T01-T08 | Packed artifact external consumer fixture (tarball install, runtime smoke) | Consumer app runtime check | Client-only/server separation checks | N/A | Artifact install + run tests | Packaging docs | Tested | `tmp/packs` artifacts + `fixtures/consumer-smoke` verification |
| T10 | T01-T09 | Full acceptance verification and readiness report with A01-A22 evidence and unresolved blockers | Accessibility + responsive checks results | API/error/auth/concurrency results | Setup/upgrade/retention results | Full suite execution logs | Sprint report + doc alignment | Tested | `docs/sprints/first-working-version-report.md` |

## Planned concrete outputs

- Monorepo structure with packages:
  - packages/form-core
  - packages/form-server
  - packages/form-postgres
  - packages/form-react
  - packages/form-builder
- Apps:
  - apps/example-minimal
  - apps/example-workspace
- Fixture:
  - fixtures/consumer-smoke
- Infra/scripts:
  - docker-compose.yml
  - SQL migrations + CLI scripts
- Reports:
  - docs/sprints/first-working-version-report.md

## Acceptance traceability approach

- Implement acceptance-oriented tests grouped by A01-A22.
- Keep an explicit matrix in the final report with command, result, and artifact references.
- Any unmet acceptance item will be marked Incomplete with concrete blocker evidence.

## Current blockers

- Host port `5432` conflict required remapping local Postgres to `55432`.
- Remaining acceptance gaps are narrowed to advanced lifecycle/policy surfaces: unresolved dependency reconciliation UX, retention-policy controls, and automated accessibility coverage.


## Published UI continuation (2026-10-12)

- UI dependency contract and scoped settings: implemented and independently tested.
- Draft autosave/continuity: implemented; in-flight edit and failed-save tests pass.
- Source, import, upload, binding and retention continuation: implemented portions
  and remaining requirements are recorded in the latest report; not full closure.
- Automated UI accessibility: basic desktop/narrow surfaces tested; human review pending.
- Database execution: blocked in this environment. Run the 9 DB-dependent tests on
  the normal local PostgreSQL setup, including the 0001-to-0002 upgrade test.
- Original A04/A09/A12/A13/A15/A16/A18/A19/A21 remain partial; no requirement is erased.

## Continuation checkpoint: 2026-10-13

Review branch: `feat/ui-0.2-integration`; draft PR #1 targets the preserved initial
implementation branch. Added typed API field-error/permission recovery, stable
lost-response submission keys, pending-submit protection and transactional record
save/replay persistence. Normal tests now use fixtures/mocks only. Dedicated
SQL/API tests require the explicit integration command and `FORM_TEST_DB_URL`.
The report now distinguishes default-profile evidence from outstanding native
PostgreSQL coverage. All nine previously partial acceptance IDs were revisited
in this branch. A12/A13/A16/A18/A21 have stronger automated evidence in default
test/browser profiles; however, A12/A13/A18/A21 remain partial until their full
end-to-end acceptance criteria are verified. A04/A09/A15/A19 still require
dedicated native-PostgreSQL integration execution (`FORM_TEST_DB_URL`) to close
with full end-to-end confidence, and native PostgreSQL concurrency verification
remains explicitly outstanding.
