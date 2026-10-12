# First working version report

Date: 2026-10-12
Branch: feat/first-working-engine
Candidate version: 0.1.0 (internal, unpublished)

## Outcome summary

Implemented an end-to-end working tranche with:

- Core schemas and comparison/normalization helpers.
- PostgreSQL migrations/repository/idempotency storage.
- Express service with secure-by-default policy adapter, definition-driven validation, form management endpoints, history/migration endpoints, and upload endpoints backed by storage adapters.
- React renderer and builder/manager packages with condition-aware required checks, source-aware submission, and import/export utilities.
- Two Vite example apps wired to the live API (create, draft save, publish, capture submit, history, archive/import/export actions).
- Local infra via Docker Compose (Postgres baseline; filesystem-first upload mode).
- Tarball artifact packing and consumer smoke fixture verification.

This pass closes major cross-package runtime gaps and removes hardcoded server title/profile logic from the engine path.
Remaining incomplete criteria are explicitly listed below.

## Commands and results

### 2026-10-12 verification addendum

- Browser workflow checks (normal click/tap interactions only; no forced/eval click bypass)

Result highlights:

- Minimal example (`http://127.0.0.1:4175`):
	- Builder save and publish completed with accurate status transitions: `unsaved` -> `saved - Draft saved` -> `saved - Published successfully`.
	- Conditional-rule reference cleanup validated by adding a condition referencing `First name`, removing that field, then saving/publishing successfully without `Unexpected error`.
	- Drag-and-drop reorder on the canvas changed ordering and marked the draft `unsaved` as expected.
	- Rules/data/layout property tabs and representative field preview tiles remained interactive during edits.

- Workspace example (`http://127.0.0.1:4174`):
	- Builder edits persisted through save/publish (example: `First name` label changed to `First name verified` and remained after reload).
	- Renderer submit succeeded after publication (`POST /api/records` 201), followed by history recall (`GET /api/records/:id/history` 200) with expected field values.
	- History rendering now resolves and uses per-revision definition snapshots by `definitionId` so older revisions continue showing their original published labels after later form edits/publications.
	- Reload persistence validated: form list reload, builder reopening, renderer fields, and record history flow all remained functional after page refresh.

- Failed save/publish behavior checks

Result highlights:

- With backend intentionally stopped during an active builder edit, `Save draft` returned a network failure and builder status changed to `error - Failed to fetch`.
- In the same failure scenario, the edited field label remained intact in UI state (`Network failure test`), confirming failed saves preserve edits.
- Minimal host save/publish callbacks now throw when no connected form exists, preventing false-success status transitions.

- Server runtime log verification (`@coderlifenet/form-server` dev server)

Result highlights:

- No new `500 INTERNAL_ERROR` responses during the exercised create/save/publish/submit/history flows.
- Observed statuses were 2xx/201/304 for the exercised routes including:
	- `POST /api/forms` -> 201
	- `PUT /api/forms/:id/draft` -> 200
	- `POST /api/forms/:id/publish` -> 201
	- `POST /api/records` -> 201
	- `GET /api/records/:id/history` -> 200

- `npm install`

Result: success, lockfile created.

- `npm run build`

Result: success across all workspaces.

- `npm run dev:infra`

Result: success with Postgres container startup and host port remap to `55432`.

- `FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:migrate`

Result: success (`Migrations applied`).

- `FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:seed`

Result: success (`Seeded form ...`).

- `FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm test`

Result: success; `form-core`, `form-postgres`, `form-server` suites passing, including expanded `form-server` acceptance integration coverage.

- `npm run -w @coderlifenet/form-server test`

Result: success; includes upload route coverage and acceptance integration tests for:

- existing-record historical definition retention after later publish/duplicate/import-replace
- dynamic source application + conditional requiredness + API field error mapping
- single/multi upload submission + download + cross-tenant access denial
- duplicate/import stable ID remapping (including rule + option reference remap)
- explicit migration preview + validation-gated migration commit
- unsupported/unsafe regex rejection with field-level validation error (`REGEX_UNSAFE`)

- Browser workflow checks (real API + DB + filesystem storage)

Result highlights:

- Workspace example: create form -> builder publish -> capture submit -> history view succeeded.
- Minimal example: create form -> publish -> renderer submit succeeded.
- Submission persisted across backend restart (`record_9hlNs2pDRtC9` history remained queryable).

- Filesystem upload lifecycle checks (real API)

Result highlights:

- `POST /api/forms/:formId/uploads` returned upload id.
- `GET /api/uploads/:uploadId/download` returned uploaded bytes.
- `DELETE /api/uploads/:uploadId` returned 204.

- Runtime HTTP checks against `packages/form-server/dist/dev-server.js`

Result highlights:

- `GET /health` -> 200
- anonymous `POST /api/forms` -> 403
- authorized `POST /api/forms` -> 201
- `POST /api/forms/:id/publish` -> 201
- idempotent `POST /api/records` replay with same key/payload -> single replayed success
- same key with changed payload -> 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`

- `npm run pack:artifacts && npm run verify:consumer`

Result: success; tarballs generated and consumer fixture validated expected artifacts.

## Example identities and purpose

Default policy adapter behavior:
- Development cookie session auth can be enabled via `FORM_DEV_AUTH=true` and `POST /dev/login`.
- Header-based context resolution is disabled by default and only available when `FORM_DEV_ALLOW_HEADER_CONTEXT=true`.
- Without a host adapter or dev auth mode, access is deny-by-default except optional anonymous submit when `FORM_ALLOW_ANON_SUBMIT=true`.

## A01-A22 acceptance evidence matrix

Status legend:
- PASS: implemented and verified with evidence
- PARTIAL: implemented partially and/or not fully verified
- BLOCKED: external blocker prevented verification
- FAIL: not implemented

| ID | Status | Evidence / Notes |
| --- | --- | --- |
| A01 | PASS | `npm install`, `npm run build`, `npm run dev:infra`, `npm run db:migrate`, `npm run db:seed` succeeded. |
| A02 | PASS | Builder canvas now supports representative tile preview, drag-drop reorder, and keyboard move/resize shortcuts (`Alt+ArrowUp/Down/Left/Right`) with persisted save/publish behavior validated in browser checks. |
| A03 | PASS | Server-side publish endpoint with optimistic revision check and immutable `published_definitions` entries validated via tests/runtime calls. |
| A04 | PARTIAL | Definition source resolution is now definition-driven in submit path and demo sources live in the host server wiring; option refresh semantics remain incomplete. |
| A05 | PASS | Local + server validation path verified with field-level API errors; failed submit/save scenarios preserve user edits and return truthful status (`VALIDATION_FAILED`, builder `error - Failed to fetch`). |
| A06 | PASS | Submission persistence and revisioning verified: record saves survive refresh/restart, and update flows produce exactly one additional revision per write with immutable prior revisions preserved. |
| A07 | PASS | Existing records remain bound to original `definitionId` after later draft edits/publications/duplicate/import-replace; history renders per-revision definition snapshots to preserve original label meaning. |
| A08 | PASS | Migration preview + commit endpoints verified end-to-end: preview reports required-field gaps; commit is validation-gated and rejects invalid migrations with `MIGRATION_VALIDATION_FAILED`. |
| A09 | PARTIAL | Workspace/project examples model parent default and override conceptually; server-enforced binding inheritance/pinning logic is not complete. |
| A10 | PASS | Cross-tenant forged access checks verified in integration tests: outsider tenant cannot read drafts/definitions/exports/downloads and cannot obtain record history data from another tenant. |
| A11 | PASS | Idempotency key storage + payload hash mismatch rejection + replay behavior verified via runtime endpoint checks. |
| A12 | PARTIAL | Conflict + idempotency mismatch behaviors exist; full session-expiry/revoked-permission/network stale-async handling matrix incomplete. |
| A13 | PARTIAL | Single and multi-upload create/attach/download flows are now verified end-to-end (including cross-tenant denial), while retry/cancel/orphan-cleanup policy UX remains incomplete. |
| A14 | PASS | Duplicate + import-as-new remap verified with assertions: fresh field IDs/options plus rule/option reference remapping without source-form mutation. |
| A15 | PARTIAL | Replacement import preview/commit endpoints are implemented for draft replacement, but unresolved dependency reconciliation blocking is still incomplete. |
| A16 | PARTIAL | Import envelope/schema validation and regex safety were strengthened (server-side safe regex matcher + `REGEX_UNSAFE` handling), but full malformed/deep/prototype-pollution hardening coverage remains incomplete. |
| A17 | PASS | Compact/new/edit renderer paths share requiredness checks and server validation; compact cannot bypass required fields. |
| A18 | PARTIAL | Form archive/restore and record erasure APIs are implemented (including uploaded object cleanup), but retention policy controls are still incomplete. |
| A19 | PARTIAL | Fresh install + migration path validated; sequential upgrade matrix/backward compatibility coverage remains incomplete. |
| A20 | PASS | Packed artifact flow verified repeatedly (`pack:artifacts` + `verify:consumer`) with consumer fixture proving tarball-based consumption path. |
| A21 | PARTIAL | Manual keyboard/focus checks were exercised during browser verification, but no automated a11y suite is in place yet. |
| A22 | PASS | Both example apps now run against the live API and were exercised through publish + submit flows in browser verification. |

## External blockers encountered

1. Local host Postgres port `5432` already occupied.
- Mitigation: remapped compose Postgres to host `55432` and documented corresponding `FORM_DB_URL`.

## Security and accessibility scope completed

Completed:
- Basic deny-by-capability path for anonymous design endpoints.
- Idempotency replay/payload mismatch behavior.
- Tenant-scoped persistence path in repositories.

Pending:
- Full operation-by-operation authorization matrix and forged-request suite.
- WCAG 2.2 AA automated checks.
- Human accessibility/security review.

## Package artifact evidence

Generated tarballs under `tmp/packs`:
- `coderlifenet-form-core-0.1.0.tgz`
- `coderlifenet-form-postgres-0.1.0.tgz`
- `coderlifenet-form-server-0.1.0.tgz`
- `coderlifenet-form-react-0.1.0.tgz`
- `coderlifenet-form-builder-0.1.0.tgz`

Consumer fixture verification:
- `npm run verify:consumer` passed.

## Branch/commit/publication/license status

- Branch: `feat/first-working-engine`
- Commits: not yet created in this automated session.
- Publication: not performed.
- License: still owner-controlled and unresolved for public publication.

## TrackForge next steps (without changing TrackForge)

1. Implement hardened server policy adapter integration with real TrackForge auth context.
2. Add binding resolution APIs for workspace/project inheritance semantics and pin/latest behavior.
3. Add explicit task-association mapping strategy for managed supplemental records.
4. Complete upload authorization and retention/erasure policies before production usage.
