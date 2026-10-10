# Proposed architecture and lifecycle

All technical recommendations here are proposed unless docs/decisions.md explicitly records approval. No dependencies or runtime contracts are implemented.

## Boundaries

| Module | Responsibility |
| --- | --- |
| Core | Schema, validation, stable identities, declarative rules, comparisons and migration contracts |
| React renderer | Full/compact capture, editing, read-only and historical views |
| React builder | Palette, canvas, properties, dependency selection, preview and import/export |
| Service | Publication, mutations, permission checks, idempotency, concurrency and transactions |
| Storage contracts | Persistence operations and transactional guarantees |
| PostgreSQL reference adapter | Schema, migrations and query/index behavior |
| Upload integration | Authorized storage, upload lifecycle and retention |
| Examples/docs | Verified default integration and public guidance |

Proposed initial path: TypeScript, Node.js and PostgreSQL. HTTP framework, ORM, package names and manager are undecided. The default experience must work completely; alternative adapter support is not promised until tested.
Inspect actual CoderLife UI exports and peer compatibility before choosing dependencies. Use one compatible theme/provider arrangement.

## Conceptual models

- Form: stable container identity and lifecycle.
- Definition draft: mutable candidate with concurrency token.
- Published definition: immutable fields/options/layout/rules/source references, schema version and publication metadata.
- Binding: generic host scope and inheritance assignment.
- Record: stable collected-data identity and current revision pointer.
- Record draft: optional incomplete capture state; not a completed submission.
- Record revision: immutable values plus exact published-definition reference and permitted selected-label snapshots.
- Audit event: security-relevant action metadata, distinct from value history.
- File reference: authorized stored object metadata and revision associations.

Example: inspection v1 uses condition option "Needs repair"; v2 renames the stable option to "Service required" and adds inspection date. A v1 revision keeps its original label and rules. Updating current definitions never manufactures dates in old records.

## Proposed historical policy

Existing records edit under their assigned definition by default. Explicit migration previews conversion and validation, then produces a new revision against the target definition. Earlier revisions stay unchanged.
Publish a new version to revert a definition; never mutate the original.
Compatible constraint changes and type/meaning changes require different policies; incompatible conversion must be explicit or use a replacement identity.
Record and definition comparisons are separate features. Cross-version record comparison must show renamed, added, removed and incompatible fields rather than guessing equivalence.

## Proposed inheritance policy

Materialize the resolved definition at publication and retain provenance. This makes old records reproducible without an intact chain of mutable parents.
Parent changes must not mutate published snapshots. Surface affected drafts for deliberate update.
Collection replacement is the starting recommendation; per-property overrides and any merge rules need exact design.
Snapshot host capabilities' identifiers/contract versions as needed; historical meaning must not depend on fetching live options.

## Values and hooks

Separate persisted values from dynamic options and field interaction state.
Registered sources declare compatible types, context, permissions, configuration contract and selected-item resolution. Builder stores references, not code.
Server resolves/verifies owner-controlled values and option eligibility at save time. Snapshot selected display meaning where history needs it.
Define synchronous/asynchronous phases, hook ordering, cancellation, dependency cycles, bounded fan-out and response generations before implementing.
No automatic refresh of saved values. Create-only, deliberate edit-refresh and display-only are distinct policies.
Dependencies must not expose sensitive hidden values to unauthorized clients.

## Persistence and mutation recommendations

Start with managed records linked to host business records. Arbitrary host-record persistence/history adapters are later work; UI-level mapping contracts can be designed now.
Store custom values as structured JSONB and index selected queryable values deliberately. Avoid a column per field.
Publish and record mutations must be transactional, with expected revisions and explicit conflict responses.
Specify idempotency key scope, payload matching, response replay and expiry; a lost response must not create a duplicate.
Check permissions on each operation, including retries. Do not accept client tenant/owner claims as authority.
Reference integrity must protect definition/revision/file associations while allowing authorized retention/erasure workflows.

## Still to design

Safe regex mechanism; upload reference provider and scanning controls; migrations runner; authorization contract; errors/API schemas; query limits; encryption responsibilities; inherited binding behavior; exact condition semantics; dependency portability; old-version editing availability; licensing.
