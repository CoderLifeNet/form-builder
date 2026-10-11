# Decision log

Baseline: October 10, 2026. Approval reflects the supplied project brief and explicit discussion. It does not imply approval of every proposed technical detail.

Track each decision separately from delivery evidence. "Implemented" requires repository changes; "tested" requires recorded checks; "human-reviewed" requires an explicit human review.

| ID | Decision | Decision status | Implementation | Tested | Human-reviewed |
| --- | --- | --- | --- | --- | --- |
| D01 | Independent end-to-end npm form engine; no TrackForge domain coupling | Approved requirement | Not started | No | No |
| D02 | Host-owned deployment/data/identity; mandatory server authorization | Approved requirement | Not started | No | No |
| D03 | Framework-independent core and default CoderLife React UI | Approved requirement | Not started | No | No |
| D04 | Immutable definitions and exact-version record revisions | Approved requirement | Not started | No | No |
| D05 | Grid builder, drag/drop and keyboard equivalents | Approved requirement | Not started | No | No |
| D06 | Per-field properties, information tooltips, blur/server errors | Approved requirement | Not started | No | No |
| D07 | Builder-configured dynamic sources, conditions and interaction states | Approved requirement | Not started | No | No |
| D08 | Preset validation and safe advanced custom regex | Approved requirement; mechanism open | Not started | No | No |
| D09 | Single/multiple file uploads | Approved requirement; storage design open | Not started | No | No |
| D10 | Duplicate and portable independent-copy/replacement import | Approved requirement | Not started | No | No |
| D11 | Initial/upgrade migrations and CoderLifeNet public docs | Approved requirement | Not started | No | No |
| D12 | 0.x.x development; explicit owner approval for every major | Approved policy | Documented | Runtime gate pending | No |
| D13 | Node/TypeScript/PostgreSQL reference stack | Proposed | Not started | No | No |
| D14 | Immutable resolved inheritance snapshots with provenance | Proposed | Not started | No | No |
| D15 | Existing records stay on assigned version unless migrated | Proposed | Not started | No | No |
| D16 | Managed records first; full host-record adapters later | Proposed | Not started | No | No |
| D17 | JSONB custom values and deliberate indexes | Proposed | Not started | No | No |
| D18 | Ready-made form repository/catalog | Explicitly out of current scope | Not started | No | No |
| D19 | Optional visual pulse/physical haptic integration | Proposed optional behavior | Not started | No | No |

## Open choices before implementation

- Final product/package names, license, package boundaries and tooling.
- Real shared UI export/peer compatibility and provider arrangement.
- HTTP mounting framework, storage/ORM/migration tools and upload reference setup.
- Condition semantics, protected values and rules for disabled/hidden required fields.
- Host registry, source versioning, lifecycle phases and safe custom validators.
- Inheritance collection rules, binding updates, migration/conversion and comparison policies.
- Public submission abuse controls, retention/erasure and sensitive field policies.
- Release/migration automation and upgrade failure recovery.

## Change procedure

Record the date, owner decision and reason when changing status or superseding a policy. Keep superseded decisions traceable.
Record implementation commits/PRs, validation evidence and human review independently. No conversation approval of requirements counts as testing or review of code.

## October 11, 2026 — storage scope clarification

D20: Approved direction: provider-neutral upload engine; optional Garage Docker reference rather than a mandatory MinIO/LocalStack service. Consumer storage remains host-controlled. A filesystem adapter is included as the minimal reference path for traditional host-server uploads in the revised sprint.
Implementation: not verified here. Provider tests: not verified here. Human review: pending.

Copilot's reported local baseline remains incomplete against its own A01–A22 matrix. Only main was visible through the connector during this documentation update; local implementation code was not reviewed. The continuation prompt directs code/test reconciliation on the existing implementation branch.

## October 11, 2026 — unreleased cleanup policy

Approved clarification: no deployed customer files/records exist. Remove abandoned provider implementations and do not create legacy routing/transfer/compatibility code. Project-scoped disposable development resources may be reset. Consolidate unreleased prototype schemas while retaining functional migration infrastructure; avoid artificial upgrade tests. This does not relax product history/immutability requirements. Runtime cleanup and acceptance remain unverified here.
