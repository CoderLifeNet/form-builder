# Roadmap

Only repository/documentation setup is currently authorized. Phases below are plans, not authorization to implement.

| Phase | Scope status | Delivery status |
| --- | --- | --- |
| 0: Repository foundation | Authorized | Documentation baseline established |
| 1: Contract and UX design | Discovery in progress | Not finalized |
| 2: Core, persistence and service | Proposed sequence | Not started |
| 3: Renderer and capture lifecycle | Proposed sequence | Not started |
| 4: Visual builder and portability | Proposed sequence | Not started |
| 5: Integration and release readiness | Proposed sequence | Not started |

## 0. Foundation

README, indexed requirements, architecture proposals, decision log, roadmap, contributor instructions and release policy.
No implementation scaffold or claimed package availability.
Repository description/settings require tooling support. License remains undecided.

## 1. Design and compatibility investigation

Frontend: builder canvas/properties, grid/mobile behavior, tooltip interactions, error states, conditional controls, file states, preview, record/history concepts.
Core/service: definition/value contracts, rule semantics, source registry/hooks, authority boundaries, compact capture, errors and publication.
Database: conceptual schema, revisions, transactions, retention/erasure and migration policy.
Inspect shared UI exports and peer compatibility before selecting dependencies.
Acceptance: coherent contracts, complete user journeys, material decisions recorded, and approved work packages identifying frontend/backend/database/docs responsibilities.

## 2. Core, persistence and service

Implement agreed schemas, safe validation/rules, storage contracts and reference migrations, definition lifecycle, managed records, revision history, authorization, concurrency and idempotency.
Include upload backend/storage lifecycle and dynamic source validation.
Acceptance: immutable definition and historical integrity tests; meaningful transaction/concurrency/idempotency/lost-response tests; identity/permission/tenant isolation tests; fresh setup and upgrade checks.
No frontend-only substitute for server enforcement.

## 3. Renderer and capture

Full/compact/new/saved/read-only/historical interfaces, per-field configuration, dynamic values/options, conditional states, blur/server errors and files.
Acceptance: values survive failures; defaults never overwrite old records; stale async responses cannot overwrite current context; saved missing options remain intelligible; server errors map correctly; keyboard/focus/announcements verified.
Historical views preserve exact definitions and selected meanings without current-source substitution.

## 4. Builder and reuse

Palette/canvas/properties, row/width editing, drag/drop with keyboard equivalents, source selection, conditions, regex trial/validation, preview/publication and history.
Duplicate/export/import: fresh identities, internal remapping, validated replacement, preserved historical records and dependency reconciliation.
Acceptance: keyboard-accessible builder operations; malicious/oversized import rejection; portable dependencies surfaced; publication remains explicit; independent copies cannot affect originals.

## 5. Default integration and releases

Verified reference application, setup/database migration instructions, host identity/permissions, compatibility matrix, npm README and CoderLifeNet documentation content.
Acceptance: end-to-end design → publish → capture → reopen → edit → history; upload access/cleanup; upgrade from previous supported schema; WCAG-oriented automated checks plus manual review.
Select license and verify package metadata before publishing. Owner approves release/version. 1.0.0 requires separate explicit approval, not completion of a phase.

## Later or separately scoped

Ready-made form repository/catalog (not current scope), multi-field drag selection, repeated collections, computed fields, rich content/signatures, collaborative editing, full host-record adapters, additional reference integrations, webhooks and third-party automation.

## Work package standard

Each implementation prompt identifies a coherent outcome, affected repo(s)/module(s), frontend/backend/database/migration/docs work, dependencies, acceptance criteria and evidence required.
Do not split a single cohesive feature into separate tickets for individual label/style changes.
Status must distinguish proposed, approved, implemented, tested and human-reviewed.
