# First working version report

Date: 2026-10-12
Branch: feat/first-working-engine
Candidate version: 0.1.0 (internal, unpublished)

## Continuation: unfinished acceptance closure pass (2026-10-13)

Branch: `feat/ui-0.2-integration` (PR #1 review branch preserved).

This pass focused on unfinished acceptance IDs A04/A09/A12/A13/A15/A16/A18/A19/A21 without changing publication boundaries, the pinned `@coderlifenet/ui-core` + `@coderlifenet/ui-components` `0.2.0-alpha.0` pair, host-owned analytics, autosave continuity, immutable publications, historical rendering, API field errors, or transactional idempotent submission behavior.

Implemented and verified in this pass:

- Restored host-owned analytics extension wiring in both example hosts (`UIExtensionsProvider` + host runtime/adapter) from the preserved pre-switch stash.
- Renderer recovery/error-path coverage for session-expired and permission-revoked responses, plus pending-submit duplicate suppression.
- Renderer option-refresh continuity coverage to assert saved selection preservation and non-reapplication of defaults during refresh paths.
- Upload UI coverage for retry and cancellation behavior in addition to existing multi-file persistence checks.
- Server route coverage for binding save/resolve/reset optimistic conflict behavior.
- Server route coverage for dependency reconciliation blocking (`DEPENDENCIES_UNRESOLVED`) before publish.
- Server route coverage for archive/restore and historical-upload deletion protection (`UPLOAD_IN_HISTORY`).
- Import hardening: explicit oversized-envelope rejection (`IMPORT_TOO_LARGE` -> `UNSAFE_INPUT`) in import pipeline and unit coverage for malformed/unsafe payload rejection.

### Commands and current results

| Command | Result |
| --- | --- |
| `npm install` | PASS (local dependency restoration for test tooling). |
| `npm run build -w @coderlifenet/form-core && npm run build -w @coderlifenet/form-postgres && npm run build -w @coderlifenet/form-server && npm run build -w @coderlifenet/form-react && npm run build -w @coderlifenet/form-builder` | PASS. |
| `npm run typecheck` | PASS across workspace packages and both example apps. |
| `npm test` | PASS in default fixture/mock profile; DB integration suites intentionally skipped without `FORM_RUN_DB_TESTS=true`. |
| `env -u FORM_TEST_DB_URL npm run test:integration` | Expected refusal (exit 1): dedicated `FORM_TEST_DB_URL` is required and `FORM_DB_URL` is ignored by design. |
| `npm run test:browser` | PASS: 14 Playwright checks across desktop + narrow viewports, WCAG tags, keyboard action/outcome checks, popup focus-restore verification, responsive overflow checks, and history keyboard operability. |
| `npm run pack:artifacts` | PASS: fresh tarballs produced for all runtime packages. |
| `npm run verify:consumer` | PASS: isolated consumer fixture install verified packed artifacts with exact registry UI dependency pair and runtime checks. |

### Acceptance delta for requested unfinished IDs

| ID | Status after this pass | Evidence |
| --- | --- | --- |
| A04 | PARTIAL | Trusted source resolution and stale-option continuity are covered in renderer/server tests, including preserved saved selections during refresh; full dedicated DB-backed end-to-end execution remains pending. |
| A09 | PARTIAL | Binding save/resolve/reset conflict behavior is now covered at server route level; native PostgreSQL integration execution remains pending in this environment. |
| A12 | PARTIAL | Implementation coverage improved (autosave serialization, stale async protection, 401/403 truthful recovery messaging, pending-submit duplicate suppression), but full acceptance still needs dedicated end-to-end conflict/session-expiry/recovery verification on native PostgreSQL flows. |
| A13 | PARTIAL | Upload restrictions/retry/cancel, attached-history deletion protection, and cleanup retry behavior are covered in automated tests, but full acceptance still needs end-to-end storage lifecycle verification against dedicated integration infrastructure. |
| A15 | PARTIAL | Publish blocking on unresolved capability dependencies is covered; full replacement-import reconciliation flow with dedicated DB integration run remains pending. |
| A16 | PASS | Malformed/unsafe/oversized import paths and unsafe pattern validation are now explicitly enforced and tested. |
| A18 | PARTIAL | Archive/restore and retention/erasure cleanup/retry logic are implemented and covered in server tests, but full retention-policy and multi-stage erasure lifecycle verification remains pending in dedicated integration runs. |
| A19 | PARTIAL | Sequential upgrade tests exist but still require execution with dedicated `FORM_TEST_DB_URL`; native PostgreSQL multi-connection concurrency verification remains outstanding. |
| A21 | PARTIAL | Automated WCAG + keyboard + responsive checks now run in browser automation across manager/builder/capture/history in desktop and narrow viewports (including focused keyboard action/outcome checks), but human accessibility review remains pending by definition. |

### Preserved pre-switch stash audit (`stash@{0}`)

Stash `wip-before-ui-0.2-integration-switch` is intentionally retained and not dropped.

| File | Decision | Reconciliation note |
| --- | --- | --- |
| `apps/example-minimal/src/App.tsx` | INTEGRATED | Restored host-owned analytics extension wiring (`UIExtensionsProvider` + runtime/adapter) from stash while preserving current branch API and publish/submit behavior. |
| `apps/example-workspace/src/App.tsx` | INTEGRATED | Restored host-owned analytics extension wiring from stash while preserving current manager/builder/capture/history flow and API behavior. |
| `docs/sprints/first-working-version-report.md` | SUPERSEDED | Stash status text predated current deterministic test fixes and reconciliation; this report now supersedes that text with explicit implementation-vs-verification status. |
| `packages/form-builder/README.md` | SUPERSEDED | Stash callback names (`onDirtyStateChange`, `onManualSaveSuccess`, `onReloadDraftAfterConflict`) no longer match the current exported API contract (`onSaved`, `onReloadDraft`, `onDefinitionChange`). |
| `packages/form-builder/src/index.tsx` | SUPERSEDED | Stash embedded analytics/accessibility schema editors and alternate callback contract were replaced by current tracking/accessibility editors and save queue contract already used by examples/tests. |
| `packages/form-core/src/index.test.ts` | SUPERSEDED | Stash tests targeted the older analytics-schema variant; current tests align with the active tracking/accessibility schema used across renderer/builder/server. |
| `packages/form-core/src/index.ts` | SUPERSEDED | Stash introduced `analytics` shape that diverges from current `tracking` contract and would break compatibility with current builder/renderer/server assumptions. |
| `packages/form-react/README.md` | SUPERSEDED | Stash docs reflected older analytics payload wiring; current runtime is boundary-based tracking with content-free events and deterministic stale-source handling. |
| `packages/form-react/src/index.tsx` | SUPERSEDED | Stash local semantic-event emission path diverges from current tracking contract and would regress recent source-refresh/pending-submit/recovery logic coverage. |
| `packages/form-server/src/definition-engine.ts` | SUPERSEDED (already landed) | Stash import-hardening intent is already present in branch code (`IMPORT_TOO_LARGE` plus safe input checks); no additional delta remained to integrate. |

## Continuation: test profiles and record-save recovery (2026-10-13)

Review: https://github.com/CoderLifeNet/form-builder/pull/1 (draft).

Implemented typed browser API errors with field-error preservation, readable
permission recovery, stable lost-response retry keys in both hosts and pending
submission protection. Record mutation and its idempotent replay response now
commit in the same transaction; actor ownership and tenant/form/definition/upload
relationships are checked. Explicit migration remains the definition-change path.

Normal tests never start or connect to a DB. SQL/API suites require
`FORM_RUN_DB_TESTS=true` and `FORM_TEST_DB_URL`, set by the opt-in runner; the
runtime `FORM_DB_URL` is ignored by those suites. The integration runner connects
to an already-running dedicated test DB and does not launch Docker.

| Command | Current result |
| --- | --- |
| `npm run build` | PASS. |
| `npm run typecheck` | PASS. |
| `npm test` | PASS: 31 fixture/mock tests; 11 database cases skipped. |
| `env -u FORM_TEST_DB_URL npm run test:integration` | Expected refusal, exit 1; no database connection attempted. |
| `npx playwright install chromium` then `npm run test:browser` | PASS: 10 isolated UI/keyboard/axe cases. Browser installation was needed after an initial missing-executable failure. |
| `npm run pack:artifacts` | PASS. |
| `npm run verify:consumer` | PASS: isolated packed install with exact registry UI pair, exports/catalog/types/SSR theme checks. |
| `node /workspace/scratch/9507f17350ba/wasm-db/run.mjs` | Supplemental verification: migrations, 4 persistence and 6 API/database cases PASS using a temporary PGlite PostgreSQL socket and the real pg driver. Native multi-connection concurrency case explicitly skipped. Runner and portable DB packages are scratch tooling, not shipped dependencies. |
| `git diff --check` | PASS. |

Portable verification exercises real SQL and transactions with disposable fixture
records, not production data. Its single PostgreSQL session is not native server
concurrency evidence. Native PostgreSQL concurrency, live S3-compatible storage,
richer browser coverage and human accessibility review remain outstanding.
A04, A09, A12, A13, A15, A16, A18, A19 and A21 remain partial. The preceding UI
integration evidence below is historical; this addendum supersedes its current
counts and records SQL progress without declaring acceptance complete.

Changed paths: React client/renderer and tests, both example hosts, persistence
transaction/revision code and tests, service submission and acceptance test gating,
root test script, README, UI integration guide and sprint plan/report.

## Current continuation: published UI pair (2026-10-12)

Branch: `feat/ui-0.2-integration`, based on remote `feat/first-working-engine`
at `316e46df1113968aeed5beae40fe9eec4ae3adc2`. No local checkout existed in this
workspace; unpushed work on the owner's computer could not be inspected. The
original implementation branch is preserved. This is still an unpublished
internal 0.1.0 candidate, not a completed engine or publication decision.

### Implemented

- Exact ui-core/ui-components 0.2.0-alpha.0 peers/dependencies, compatible React
  peers, lockfile and installation/type/runtime consumer checks.
- Persisted form/field tracking and accessibility presentation, catalog validation,
  actual ui-core scopes, default opt-out, content-free instrumentation and no
  nested library providers. Independent copies remap tracking IDs and references.
- Serialized autosave, manual-save completion callback, explicit reload after
  failed/conflicting save, preserved mounted draft across example navigation,
  and synchronous host revision tracking after a pre-publication draft save.
- Accessible field helpers/errors/tooltips, responsive builder layout, safe empty
  history and exact-revision label rendering. Fixed an axe contrast failure and
  narrow-screen overflow rather than suppressing either test.
- Cancellable option/value source initialization/refresh, stale-result protection,
  unavailable selection preservation, trusted source API and publish-time capability
  reconciliation. UI exposes deliberate reconnect/remove/declaration removal.
- File picker progress/cancel/retry/removal, example HTTP upload handlers, selected
  labels and upload IDs on submission, MIME signature/type/size checks, count checks.
- Generic binding save/resolve/reset APIs with host-owned ancestor resolution,
  optimistic revisions and optional submission binding verification.
- Durable storage deletion queue, explicit incomplete-erasure response, attached
  upload deletion protection and host-configured pending-upload expiry/retry.
- Import size/depth/prototype checks, unsupported-format rejection, unique identity
  validation, shared forward-reference/default/source/tracking remapping and safe
  RE2 matching on both server and browser paths.

### Verification in this environment

The final command results below concern this continuation only. Earlier sections
retain historical evidence from the previous developer environment; they are not
fresh verification of changed database code.

| Command | Result |
| --- | --- |
| `npm view @coderlifenet/ui-core@0.2.0-alpha.0 version peerDependencies --json` | Exact registry version and peer contract verified. |
| `npm view @coderlifenet/ui-components@0.2.0-alpha.0 version peerDependencies --json` | Exact registry version and core peer verified. |
| `npm ci` | PASS. |
| `npm run build` | PASS; Vite warns about large example bundles. |
| `npm run typecheck` | PASS across packages and both examples. |
| `npm test` | PASS for available tests; 27 passed, 9 DB-dependent tests skipped. Skips are not passes. |
| `npm run test:browser` | PASS: 10 desktop/narrow normal-interaction, keyboard and axe checks in the isolated UI fixture. |
| `npm run pack:artifacts` | PASS; tests/source are excluded from runtime tarballs. |
| `npm run verify:consumer` | PASS: real isolated tarball install plus exact registry UI pair, public exports, catalog parity, TSX compilation and SSR theme rendering. |
| `git diff --check` | PASS. |

Tests directly cover tracking scope/context, semantic IDs, content exclusion,
ancestor opt-out, empty allowlists, consent/global disablement, no-provider use,
accessible helpers/errors, stale option responses, in-flight autosave edits,
failed-save preservation, multiple file selections, portable forward references,
unsafe imports, upload policy checks and incomplete-erasure recovery responses.

### Database blocker and remaining acceptance items

Docker is not installed (`docker --version` fails). Portable PostgreSQL binaries
were obtainable, but `initdb` refuses root and switching to an unprivileged user
fails (`su: System error`). System package installation also failed due to the
runtime's user/group restrictions. No live database or S3 acceptance is claimed.
The original 6 server acceptance tests plus 3 persistence/upgrade tests are runnable
with `FORM_DB_URL`; they must pass on the owner’s normal Docker/Postgres environment.

All previously partial IDs remain partial until their full criteria are satisfied:

| ID | New evidence / remaining work |
| --- | --- |
| A04 | Source refresh/cancellation/stale preservation tested; full selected-item pagination/search and unavailable-option edit policy still pending. |
| A09 | Binding API/repository and runnable parent/pin/reset test added; full example binding editor and concurrent resolution DB verification pending. |
| A12 | Autosave failure/in-flight edits and stale options tested; complete expiry/revocation, cross-form in-flight switch and recovery matrix pending. |
| A13 | File controls/progress/cancel/retry plus byte/count policies added; quarantine/scanner, upload idempotency, historical file-reference lifecycle and real S3 verification pending. |
| A15 | Publication now blocks unresolved capabilities and builder supports explicit source/declaration removal; broader custom capability/version reconciliation and DB verification pending. |
| A16 | Safe traversal, bounded portable JSON, format rejection, reference integrity and RE2 implemented/tested; broader HTTP adversarial/oversized-input matrix pending. |
| A18 | Durable erasure retry queue and pending-upload TTL controls implemented; DB failure recovery, record-age retention controls and shared-reference lifecycle pending. |
| A19 | Runnable isolated 0001-to-0002 data-preserving upgrade test added; DB execution and migration-failure coverage pending. |
| A21 | Automated desktop/narrow checks now exist and pass for basic surfaces; rich dialogs, custom themes, expanded manual keyboard/assistive-technology checks and human review pending. |

No release/publication/license readiness is claimed. TrackForge and shared-library
repositories were not changed. See `docs/ui-integration.md` and
`docs/trackforge-integration.md` for current APIs, setup and limits.

## Historical outcome summary

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
