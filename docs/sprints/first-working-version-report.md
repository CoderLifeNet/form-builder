# First working version report

Date: 2026-10-11
Branch: feat/first-working-engine
Candidate version: 0.1.0 (internal, unpublished)

## Outcome summary

Implemented a first runnable monorepo baseline with:
- Core schemas and comparison/normalization helpers.
- PostgreSQL migrations/repository/idempotency storage.
- Express service with policy adapter, draft/publish/record endpoints.
- React renderer and builder/manager packages.
- Two Vite example apps.
- Local infra via Docker Compose (Postgres + LocalStack S3-compatible service).
- Tarball artifact packing and consumer smoke fixture verification.

This is not a full completion of every requirement in docs/prompts/first-working-version.md.
Items marked incomplete are explicitly listed below.

## Commands and results

1. `npm install`
- Result: success, lockfile created.

2. `npm run build`
- Result: success across all workspaces.

3. `npm run dev:infra`
- Result: success after remapping Postgres to host port `55432` and switching object storage to LocalStack due unavailable MinIO image pulls.

4. `FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:migrate`
- Result: success (`Migrations applied`).

5. `FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm run db:seed`
- Result: success (`Seeded form ...`).

6. `FORM_DB_URL=postgres://formbuilder:formbuilder@localhost:55432/formbuilder npm test`
- Result: success; `form-core`, `form-postgres`, `form-server` suites passing.

7. Runtime HTTP checks against `packages/form-server/dist/dev-server.js`
- `GET /health` -> 200
- anonymous `POST /api/forms` -> 403
- authorized `POST /api/forms` -> 201
- `POST /api/forms/:id/publish` -> 201
- idempotent `POST /api/records` replay with same key/payload -> single replayed success
- same key with changed payload -> 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`

8. `npm run pack:artifacts && npm run verify:consumer`
- Result: success; tarballs generated and consumer fixture validated expected artifacts.

## Example identities and purpose

Development-only host context headers:
- `x-tenant-id`: tenant scope
- `x-actor-id`: user identity (`owner1`, `collab1`, `outsider1`, `anonymous`)

Default policy adapter behavior:
- Anonymous can submit only (`forms.submit`)
- Authenticated users are allowed all capabilities in this baseline

## A01-A22 acceptance evidence matrix

Status legend:
- PASS: implemented and verified with evidence
- PARTIAL: implemented partially and/or not fully verified
- BLOCKED: external blocker prevented verification
- FAIL: not implemented

| ID | Status | Evidence / Notes |
| --- | --- | --- |
| A01 | PASS | `npm install`, `npm run build`, `npm run dev:infra`, `npm run db:migrate`, `npm run db:seed` succeeded. |
| A02 | PARTIAL | Builder supports adding/selecting/editing fields and draft save state, but no drag-drop pointer+keyboard parity and no persisted server-backed reload in example UI yet. |
| A03 | PASS | Server-side publish endpoint with optimistic revision check and immutable `published_definitions` entries validated via tests/runtime calls. |
| A04 | PARTIAL | Trusted profile defaults resolved server-side in submit path; backend options refresh semantics are not fully implemented in UI/state management. |
| A05 | PARTIAL | Local + server field validation path exists; accessibility/error summary behavior is basic, not fully comprehensive. |
| A06 | PARTIAL | Record revision creation is persisted and tested; complete reopen/edit/history UI workflow is not fully connected to server in examples. |
| A07 | FAIL | Full old-version edit policy, archived option semantics, and historical label/option rendering policy are not fully implemented. |
| A08 | FAIL | Explicit migration preview/commit workflows and cross-version migration UI are not implemented. |
| A09 | PARTIAL | Workspace/project examples model parent default and override conceptually; server-enforced binding inheritance/pinning logic is not complete. |
| A10 | PARTIAL | Tenant/actor capability gate and anonymous deny paths are tested; full outsider forged-request matrix across all operations is incomplete. |
| A11 | PASS | Idempotency key storage + payload hash mismatch rejection + replay behavior verified via runtime endpoint checks. |
| A12 | PARTIAL | Conflict + idempotency mismatch behaviors exist; full session-expiry/revoked-permission/network stale-async handling matrix incomplete. |
| A13 | FAIL | Full upload lifecycle (content checks, completion/download auth, cleanup, historical refs) not yet implemented end-to-end. |
| A14 | PARTIAL | Duplicate/import/export helper API exists in UI package; full internal reference remap verification and server-backed operations incomplete. |
| A15 | FAIL | Replacement import with draft-preserving destination placement and dependency reconciliation blocking is not complete. |
| A16 | PARTIAL | Core parse/validation constraints exist; comprehensive malformed/deep/prototype-pollution import hardening and unsafe pattern rejection suite incomplete. |
| A17 | FAIL | Compact capture requiredness enforcement flow is not fully implemented end-to-end. |
| A18 | FAIL | Archive toggle exists in UI model; host-authorized retention/erasure with file cleanup/recovery bookkeeping not complete. |
| A19 | PARTIAL | Fresh install + migration path validated; sequential upgrade matrix/backward compatibility coverage remains incomplete. |
| A20 | PARTIAL | Tarballs are built and fixture verifies presence; full external runtime install/use without workspace linking not fully exercised. |
| A21 | FAIL | No automated accessibility suite or manual keyboard/focus/responsive checklist evidence across all surfaces yet. |
| A22 | PARTIAL | Example apps build and run paths are present; full guide execution and doc parity checks are not complete. |

## External blockers encountered

1. MinIO images in original compose config were not pullable in this environment (`pull access denied`).
- Mitigation: switched to pinned LocalStack (`localstack/localstack:4.0.3`) + pinned AWS CLI (`amazon/aws-cli:2.22.20`) for S3-compatible local object storage.

2. Local host Postgres port `5432` already occupied.
- Mitigation: remapped compose Postgres to host `55432` and documented corresponding `FORM_DB_URL`.

## Security and accessibility scope completed

Completed:
- Basic deny-by-capability path for anonymous design endpoints.
- Idempotency replay/payload mismatch behavior.
- Tenant-scoped persistence path in repositories.

Pending:
- Full operation-by-operation authorization matrix and forged-request suite.
- WCAG 2.2 AA manual and automated checks.
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
