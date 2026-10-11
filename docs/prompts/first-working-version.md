# CoderLife Form Builder — first complete working version

Copy the instruction below into Copilot Agent in a local checkout of `CoderLifeNet/form-builder`. It is an implementation instruction, not a request for a proposal alone. This sprint delivers a working local release candidate; npm publication, public deployment, and modification of TrackForge are separate actions.

---

You are implementing the first complete working version of the reusable CoderLife form builder and manager in `CoderLifeNet/form-builder`.

Plan coherent tasks, put them in dependency order, then execute through verification and documentation. Do not stop after planning, scaffolding, a frontend demo, or one vertical slice. Work until the acceptance criteria below pass, or document a concrete external blocker that prevents further dependent work. Continue independent work when a dependency is blocked. Do not claim blocked work is complete.

## 1. Authorization, repository inspection, and execution rules

This invocation authorizes runtime implementation, dependency installation, local development infrastructure, tests, examples, and documentation in this repository. Earlier documentation described a discovery-only stage; this instruction supersedes that stage for this sprint. It does not authorize npm publication, tags/releases, public hosting, changing production databases, or writing to other repositories.

1. Read `AGENTS.md`, `.github/copilot-instructions.md`, README, and all relevant current documentation. Inspect actual repository contents and git status before planning. Do not overwrite concurrent/user changes or assume the repository is still empty.
2. Read `docs/design/ui-contract.md` and `docs/design/form-studio-reference.html` when present. The HTML is a design reference, not the production implementation. If the HTML is unavailable, use the written UI contract and this prompt; do not block on a screenshot.
3. Reconcile current documents with this prompt. Record decisions and any genuinely conflicting requirements. This prompt governs the authorized sprint where older discovery wording conflicts. Do not silently remove scope.
4. Create a feature branch such as `feat/first-working-engine`. Keep unrelated changes intact. Commit coherent milestones using the repository's configured author identity. Do not invent an identity or force-push.
5. Write `docs/sprints/first-working-version.md` before implementation. Track task IDs, dependencies, coherent outcomes, modules/repos affected, acceptance criteria, status, and evidence. Identify frontend, API/service, database/migrations, testing, examples, and documentation work within each relevant task. Avoid one task per tiny label or style edit.
6. Resolve routine implementation decisions yourself using the reference choices below. Do not ask for approval between ordinary tasks. Ask only about an unresolved decision that materially changes the product and cannot be handled within these boundaries; continue independent work.
7. Keep short progress reports focused on completed outcomes, verification, and next dependencies. Maintain resumable checkpoints if the session must continue. Do not report “complete” because the context window or tool budget ended.
8. Update repository status instructions to reflect implementation only after invocation, while preserving authorization, versioning, and project boundaries. Mark tested and human-reviewed separately; you cannot award human review yourself.
9. No delegated outbound messages, automatic external issue creation, or writes to another project. A local task plan is sufficient. Finish with a clean, reviewable branch; do not merge automatically. Push/open a PR only if authorized by the actual invocation/environment.

## 2. Product and achievable first-release boundary

Build an installable engine that lets host applications visually create forms, publish immutable versions, collect/edit data, and display historical revisions. Consumers should wire up the supplied modules rather than write their own form persistence, revision system, validation, or field error handling.

Deliver all first-release capabilities described below, including conditional fields, dynamic sources, single/multiple uploads, duplication/import/export, binding inheritance, record migration, and working integration examples. Do not reclassify these as later work to finish sooner.

Keep these outside this sprint: ready-made form catalog/marketplace, simultaneous collaborative editing, moving several selected fields as a batch, arbitrary nested repeated collections, general computed-field language, rich HTML/signatures, outbound webhooks, third-party automation, full adapters that transparently version arbitrary host business databases, and additional production platform adapters beyond the reference path.

TrackForge is the first intended real consumer, but do not modify it. Provide a generic workspace/project example and a TrackForge integration guide. The engine must not contain TrackForge domain entities or UI branding.

## 3. Reference technology and module boundaries

Default to a TypeScript workspace with:

- Framework-independent core contracts, normalization, validation, rules, comparison, and portability.
- React renderer and reusable form manager/builder/record-history components, organized by responsibility.
- Node.js service with a thin Express HTTP adapter.
- Storage contracts and a PostgreSQL reference implementation. Default to explicit SQL migrations and a maintained PostgreSQL driver rather than adding an ORM solely for convenience. If current repository code already establishes a viable maintained alternative, retain it and explain the choice.
- Upload storage contracts and an S3-compatible reference integration. Provide a local object-storage development setup, such as MinIO, so uploads actually work without a paid external account.
- A Vite/React reference host application using the real service and database.
- Package artifacts and an external-consumer smoke fixture that install packed tarballs, not only workspace source aliases.

Select supported, compatible dependency versions after inspecting their current official documentation and actual metadata. Commit one lockfile and document Node/package-manager versions. Prefer existing repository tooling; otherwise use npm workspaces to keep the setup straightforward. Pin container versions for reproducibility; never rely on unqualified `latest` tags.

Inspect actual `@coderlifenet/ui-core` and `@coderlifenet/ui-components` exports, peer requirements, and provider/theme behavior before choosing UI dependencies. Prefer the published packages; read associated sources if available. Record compatibility evidence and versions in documentation. Use one compatible theme/provider arrangement. Do not assume every MUI export exists in a wrapper.

Use verified CoderLife wrappers wherever available. Unwrapped low-level MUI access must be deliberate, minimal, documented, and compatible; do not bypass existing wrappers for convenience. Do not silently mock missing CoderLife packages. If access is genuinely blocked, complete independent engine/service work and report the dependency precisely.

Provisional package names can follow `@coderlifenet/form-core`, `form-react`, `form-builder`, `form-server`, and `form-postgres`; choose a coherent practical split and document it. Do not multiply packages needlessly. Public core contracts must not import React, MUI, Node-specific APIs, or the database adapter. Keep server exports out of browser bundles. Supply explicit exports, declarations, peer dependencies, and package READMEs.

## 4. Plan and execute coherent work packages

Adapt this sequence to the actual repository, retaining all outcomes:

1. Inspect compatibility; finalize contracts/ADRs, UI contract, task plan, and traceability.
2. Establish workspace/build tooling, package boundaries, CI, reference infrastructure and deterministic seed setup.
3. Implement schemas, stable identities, safe validation/rules, portability and comparison primitives.
4. Implement PostgreSQL schema/migrations, repositories, immutable definitions, bindings, records/revisions, audits and transaction semantics.
5. Implement trusted context/authorization, service operations, HTTP/client contracts, concurrency, idempotency and safe errors.
6. Implement registered sources/validators/lifecycle hooks and upload lifecycle/storage integration.
7. Implement renderer, blank/saved/draft/read-only/history modes, compact capture, dynamic fields and accessible errors.
8. Implement manager, grid builder, field properties, preview, publication, version history, duplicate/import/export and settings/bindings.
9. Complete record editing, comparisons and explicit migration workflows, including cross-version acceptance tests.
10. Complete both working host examples, documentation and migration/upgrade guide.
11. Run full acceptance scenarios, repair failures, verify packed-package consumer installation, and produce a readiness report.

Testing and documentation accompany each package; they are not cleanup postponed to the end. Use realistic vertical slices while retaining the complete final scope. A task is done only when its acceptance evidence exists.

## 5. Definition, layout, and identity contracts

Define a versioned, bounded, serializable form definition. Include metadata, stable field/option IDs, sections, rows, desktop widths, reading order, field configuration, rules, sources and dependency versions.

- Field types: text, multiline text, number, date-only, checkbox, single-select, multi-select, URL, single file and multiple files.
- Labels, visible help, optional placeholder, supplemental information tooltip, initial value/default, requiredness and validation are independent properties.
- Defaults apply only when creating a record, once. They never overwrite saved values, resume drafts, or resets caused by rerendering.
- Typed persisted values must distinguish missing, null, empty string, false, zero, empty list and date-only strings. Define normalization; do not coerce invalid numeric input into zero or dates into unexpected timezones.
- Manual options have stable IDs and independently editable labels. Save option identities; preserve selected historical display meaning.
- Presentation elements/sections are not record values. Layout movement and label edits do not regenerate identities.
- Use stable IDs to connect conditions, errors, source dependencies, revisions and migrations. Never depend on current label text or DOM position.
- Model sections containing rows and fields with adjustable widths. Support readable 3–5-field desktop rows, deliberate wrapping and responsive stacking. Preserve reading order on mobile. If using a fixed grid, provide a practical representation for five fields rather than assuming equal divisions always fit.
- Separate definition schema version, form publication version, package version, database migration identifier and record revision number.
- Apply payload, field, option, nesting, rule and upload limits consistently in core/service. Publish documented reasonable defaults with host-configurable bounded ceilings.

## 6. Field configuration, conditions, and safe validation

Expose these in the builder properties editor; developer hooks alone are insufficient:

- Label, help, tooltip, type-appropriate placeholder/default and requiredness.
- Manual versus application-provided values/options.
- Population policy: create-only, deliberate refresh on edit, or display-only context. Explain that saved values are preserved by default.
- Editing allowed: always, never/read-only, conditional, or host-controlled.
- Disabled, visibility and requiredness: unconditional or conditional.
- Type-appropriate presets: text length, numeric ranges/precision, date ranges, URL constraints, option counts and upload constraints. An email format preset can apply to text without inventing a separate field type.
- Advanced custom regex with useful author-supplied error message and a test area for examples.
- Desktop width, section/row assignment, order and accessible move commands.

Use readable condition controls: target behavior, other field or registered host condition, operator, typed comparison value. Support a small useful set such as equals/not-equals, empty/not-empty, and selected-option membership, with bounded AND/OR composition. Reject cycles, invalid references and excessive complexity. Do not accept arbitrary JavaScript, unrestricted HTML, evaluation strings or unregistered remote URLs.

Use a demonstrably safe regex strategy on client and server, such as a compatible non-backtracking engine with bounded input/pattern size. Verify runtime/package compatibility. Reject unsupported constructs at configuration/publication with a field-specific explanation. Never use JavaScript's unrestricted RegExp plus Promise timeout and call it CPU-safe. No silent fallback to unsafe execution. Test catastrophic-pattern attempts.

Specify condition combination/precedence and test identical client/server outcomes. Hidden/disabled/read-only do not automatically mean clear, excluded from saving, optional or authorized. Preserve stored values unless an explicitly configured and authorized action clears them. Make preservation, exclusion and validation policy understandable.

Protected host values are resolved or verified on the server. Read-only browser fields are not a security boundary. For create-only profile snapshots, edits preserve the trusted original value; do not overwrite history merely because the user's current name changed.

## 7. UI contract and accessibility

Deliver reusable product views, not a hardcoded standalone site shell. The example application may provide surrounding navigation. Capture/edit consumers do not expose builder administration controls.

Use the design reference for organization and interaction, not for its in-memory implementations. Incorporate the latest preference: secondary actions use icon-only buttons with short tooltips and accessible labels. Import tooltip is simply “Import,” not “Import new form.” Duplicate, export, archive and related actions use understandable icons. Keep primary actions such as Create form, Publish, Submit and Save changes labeled when clarity benefits. Tooltips work with hover, focus and tap and are dismissible.

### Manager

List forms with meaningful status: unpublished draft, published version with/without draft, archived. Support search, appropriate status filtering, truthful pagination/counts and empty/loading/error states. Offer create from blank/starter, open builder, duplicate, import, export and archive/restore. Preserve access to historical records when a form is archived. Do not implement authorized permanent erasure as a casual archive button.

### Builder

Palette, grid canvas, selected-field properties, preview and publication. Add fields by click or drag. Reorder fields within/between rows/sections and change width. Show insertion indicators. Every operation has a keyboard-accessible alternative. Moving fields never changes identities.

Property sections may be Basic, Data, Rules and Layout. Avoid jargon and long labels. Show inherited sources/overrides and reset actions where appropriate. Include section creation/rename/reorder and field removal confirmation when appropriate.

Implement persisted draft editing with clear unsaved/saving/saved/failure/conflict states and guarded navigation. Save draft and Publish are distinct. Handle draft concurrency explicitly instead of last-write-wins. Choose manual save or debounced autosave deliberately and document it; do not pretend local state is saved.

### Renderer

Full and compact capture, resumed incomplete draft, existing-record edit, read-only view and history. Preview desktop/mobile layouts and sample context. Native file controls and real progress/retry states. Labels and required indicators are visible and accessible.

An outlined info icon near a label shows optional supplementary information. Keep essential help visible. Tooltip text is plain safe content.

### Settings, versions and history

Form identity/settings, host policy summaries, bindings/inheritance, follow-latest versus pinned publication, form-version viewing/comparison, restoring an old version as a new draft, record history/comparison and explicit record migration. Do not expose database IDs or raw schemas in routine flows.

### Error behavior

Validate invalid fields on blur. Do not mark untouched fields red on initial load. After correction, revalidate local errors. On failed submit, show inline errors, an appropriate summary and focus the first permitted invalid field; preserve all entries/files that remain safely available.

Map API errors by stable field IDs and safe codes/messages, including multiple errors. Handle hidden/compact omitted fields without leaking unauthorized information. Server-only errors become eligible for rechecking when relevant inputs change; do not claim server acceptance before revalidation.

Distinguish network, authentication, authorization, conflict, upload and source-loading failures, with safe recovery actions. Sign-in recovery delegates to the host. No raw stack traces or sensitive values in user errors.

Target WCAG 2.2 AA: native semantics, keyboard ordering/drag alternatives, focus restoration, accessible names/error relationships, announcements, contrast, touch targets, responsive layouts and reduced motion. Do not claim certification based on an automated audit.

Physical haptics are an optional host hook; unsupported devices degrade gracefully. If a visual pulse is supplied, honor reduced motion and never use it as the only error signal.

### Prototype exclusions

The reference's “Design concept,” “Try form” navigation as an app-wide tab, “Design review only,” sample identity selector, simulated API/source failures, reset sample workspace, local-only status claims and canned sample records are demonstration infrastructure. They are not production fields, schema properties, permissions or features. Controlled simulations may live in isolated tests/examples or an explicitly marked author preview; never ship them as respondent controls.

The exported product needs real persistence, source resolution, permission enforcement, uploads and APIs. Do not copy the prototype and replace a few buttons while leaving the actual lifecycle mocked.

## 8. Persistence and migrations

Provide supplied schema and versioned migrations for at least:

- Forms, mutable definition drafts and immutable published definitions.
- Generic bindings, hierarchy/override configuration and resolved immutable configuration snapshots/provenance.
- Records, optional incomplete record drafts, immutable revisions and current revision references.
- Upload objects/reference metadata, upload lifecycle and revision associations.
- Idempotency records and scoped mutation response bookkeeping.
- Security audit events distinct from record value history.

Enforce foreign keys, uniqueness, scoping indexes and transactional integrity. Scope IDs/relationships to trusted tenants, including joining a revision to a form/version/file. Application checks alone must not permit cross-tenant associations through fabricated identifiers. Store custom values as structured JSONB; provide bounded filtering/sorting over supported/indexed paths, not unrestricted client SQL or a column per field.

Records and published definitions are immutable through normal update APIs; authorized retention/erasure remains possible through a separate policy-governed path. Published snapshots must not be overwritten in place.

Include explicit migration CLI/status, transactional behavior where supported, locking against competing runners, and a version ledger. Importing a package or starting the application must not silently migrate databases. Never rewrite an already-released migration. Seed development data separately and idempotently.

Test a fresh database and a genuine sequential upgrade preserving definitions, revisions, IDs and file references. Do not manufacture meaningless schema churn merely to claim an upgrade test. Document supported starting schemas, backups, failure recovery, any nontransactional step, and rollback limitations.

Supply managed-record mode first, with optional host business-reference metadata. Document how to render/map host properties without promising automatic historical management of arbitrary host-owned business tables. Do not build uncoordinated dual writes to TrackForge tasks.

## 9. Publication and historical correctness

- Editing a published form creates/updates a draft; publication creates a new immutable version transactionally.
- Validate full definitions server-side, including rule/source references, source capability versions, safe patterns, limits and layout.
- Default existing-record editing uses its original form version. The host may restrict old-version editing explicitly; return actionable results, never silently apply latest rules.
- Records/revisions point to exact resolved definitions. Rendering history never substitutes current labels/options, live profile names or live source queries for saved meaning.
- Preserve removed fields and archived options in old revisions. Logical removal is not erasure.
- Type/meaning changes require explicit conversion or a fresh identity; constraints may change in a new version but do not retroactively validate old records.
- Definition restore publishes a new version based on a previous one.
- Compare definition versions separately from record revisions. Cross-version comparison identifies renamed, added, removed, unavailable and incompatible fields. Imported fresh identities are not guessed equivalent based on labels.
- Provide explicit migration preview and commit: trusted target version, deliberate field/value mapping, validation issues, expected record revision and one new revision. Preserve prior revisions. Unsupported conversion fails clearly; no silent coercion or matching by label.
- Verify selected-option display snapshots on the server. Do not trust client labels; dynamic sources return permitted stable identities and labels.

## 10. Bindings, inheritance, and host integration

Keep workspace/project concepts in the host examples, not hardcoded into the core. Provide generic context/binding contracts and deterministic hierarchy resolution.

Reference behavior:

- A workspace chooses a default capture form.
- A project inherits it or explicitly chooses/customizes an allowed form.
- An authorized configuration chooses follow-latest-published or pin-to-a-specific-version. Ordinary submitters do not choose versions each time.
- Resolve assignments using trusted host scope and membership. A form ID alone never grants access.
- Materialize immutable resolved definitions/configuration for revisions and retain provenance. Parent changes affect future authorized resolution, not stored historical revisions.
- Clearly specify scalar overrides and collection replacement/merge semantics. Default collection replacement unless deliberately designed otherwise.
- Show source, override and reset-to-parent in the UI. Parent changes should flag/update drafts only through an explicit reconciliation policy, not mutate publications.
- Resolution and saving must agree on the chosen version under concurrent publication/binding changes. Reject stale/incompatible requests with an actionable conflict or save against the authorized pinned snapshot; do not silently swap definitions mid-submission.

Provide a compact-capture projection using stable field IDs. Required fields omitted from compact UI must have authorized server-provided values, an additional collection step, or an explicit incomplete-draft outcome. Never treat omitted required fields as automatically optional.

## 11. API/service, concurrency, and hooks

Define typed service interfaces and a documented HTTP contract. Generate or maintain an OpenAPI specification and typed browser client without assuming URL roots, mounting paths or host authentication details.

Implement operations for listing/creating/updating/archiving forms; draft retrieval/saving; validation/publication/version retrieval; bindings/resolution; capability discovery; source queries/selected-item resolution; record drafts/submission/edit/list/history/comparison/migration; duplication/export/import; uploads and authorized downloads; and permitted retention/erasure. Pure previews/comparisons may use core APIs where suitable, but actual mutations must be server-backed.

Use optimistic concurrency for drafts, bindings and record writes. Require expected revisions/ETags where appropriate and return structured conflicts. Never overwrite the latest revision silently. Preserve client edits and provide review/retry behavior.

Idempotent create/publication/import/submission/migration operations need documented key scope, canonical request matching, response replay, expiration and concurrent-key handling. Reusing a key with a changed payload must be rejected. Recheck authorization before replaying cached responses. Test commit-success/lost-response/retry yields one record/revision/publication.

Use transactions for mutation/revision/audit/idempotency coordination as appropriate. Paginate with deterministic ordering and counts reflecting the same permission/filter scope. Define HTTP statuses and a safe error envelope with operation and field errors, conflict metadata and correlation IDs without sensitive values.

Registered lifecycle contracts should cover initialization/value sources, option queries, selected-item resolution, field dependencies, server business validation, pre-save preparation and post-commit notification. Define ordering, validated configuration, context access, authority, cancellation/timeout, stale-response generations and idempotency implications.

Transformations must occur before final server validation or be revalidated afterward. Post-commit hook failure cannot imply a committed save was rolled back. Document notification delivery guarantees; do not claim exactly-once external side effects. No user-authored arbitrary code or arbitrary remote endpoints.

## 12. Dynamic values and sources

Host developers register named/versioned sources, validators and programmatic conditions once. Authors select those capabilities in the builder. Provide compatibility metadata, permitted configuration and capability discovery under trusted author scope.

Demonstrate application-derived first/last name, externally populated category/customer options, a dependent dropdown and an application-controlled edit condition.

Support source loading, errors, retry, cancellation, stale-result protection, bounded pagination/search and explicit resolution of a saved option outside the current page. Refreshing options must not reset values or reapply defaults.

If a saved option disappears, preserve its ID and historical label, clearly mark unavailability, and apply an explicit server edit/submission policy. Do not invent a current valid option or silently clear the record.

Server validates option eligibility and protected values in trusted context, not from client-supplied owner/tenant/hidden fields. No source fetching for historical display when the stored revision suffices.

## 13. Single/multiple uploads

Files are first-release functionality, not UI-only placeholders.

Support configured allowed media types/extensions, per-file size, count, upload progress, cancellation/retry, per-file validation errors and removal. Validate metadata and actual content signatures where applicable on the server; do not trust file extension or browser MIME alone.

Use temporary/quarantined objects with explicit completion/verification before attaching them to a record. Verify host/tenant ownership and permission on each stage. Provide a documented malware-scanning hook and honest reference behavior; do not claim unscanned files are safe or provide active-content inline execution.

Private downloads must be authorized, with safe filenames/content disposition and no guessable public buckets. Bind object references to records/revisions and trusted scope. Do not log signed URLs/credentials.

Define pending-upload expiry and cleanup, canceled uploads, removed file references, old revisions, retention and permanent erasure. Failed submission keeps safely resumable completed uploads without creating orphaned permanent records. Upload retries and completion must be idempotent.

Provide real S3-compatible local setup and tests. Credentials stay server-side. Documents state production storage/encryption/key-management responsibilities. No files can be default-prefilled through a browser file input.

## 14. Duplicate, export, and import

These are builder/manager operations only.

- Duplicate creates a new independent form draft without records, revision history, file contents or original ownership. Allocate new form/field/option/layout IDs and remap every internal reference, including conditions/default option selections/source dependency references.
- Export produces a versioned JSON design contract with descriptive metadata and dependency declarations, not a database dump. Do not include collected values, file contents, tokens, identities, access grants, actual host URLs/credentials, audit events or environment-specific binding IDs. Explicit author-entered defaults remain definition data; prevent secret-bearing configuration and explain the export contents.
- Offer export of a deliberate draft or published definition so the chosen design is unambiguous.
- Import-as-new validates and previews before creating a new independent draft.
- Replacement import warns about replacing draft fields/layout/settings, keeps destination form identity/placement, allocates fresh definition identities, and does not match old fields by label. Keep all earlier publications/records. Publish separately.
- Reject malformed/oversized/deep/prototype-polluting inputs and unsupported format versions. Parse and normalize through core schemas; do not spread arbitrary keys into configuration objects.
- Discover dependencies from definitions and verify declarations; do not trust a declaration that omits a registered capability reference.
- Surface unavailable/incompatible sources, conditions and validators. Provide a deliberate author UI to reconnect, replace or remove dependencies. Publication stays blocked until resolved; never silently discard behavior.
- Handle internal versus external identity references correctly. New identities never migrate old records automatically.

No form marketplace/catalog implementation.

## 15. Authentication, authorization, privacy, and deletion

Authentication remains host-owned. Require a server policy adapter; absent authorization must deny by default. A host may explicitly grant anonymous submit-only access, with abuse controls. Public forms never make records public by default.

Define separate capabilities for design, publish, use, authenticated/anonymous submit, read/edit, history, export, archive and delete. Check authorization for every service/HTTP operation, source resolution and upload/download, including cached idempotent results.

Trusted identity, tenant scope, membership and audit identity come from host server integration. Client request IDs are selectors to authorize, not trusted tenant/owner claims. Test direct forged HTTP requests, not only UI visibility.

Shared workspace forms belong to their authorized scope, not automatically only their creator. Private owner-scoped forms and shared memberships are distinct policies. Prevent cross-user/cross-workspace/cross-tenant access according to those policies.

Address CSRF for cookie-authenticated mounting, origin policy, session expiry, changed permissions, payload limits, rate limits and anonymous abuse. Sensitive values must stay out of logs, analytics, URLs, traces and error bodies. Integrate CoderLife analytics without collecting form values/file names/pattern examples by default.

Implement host-authorized retention/erasure for records and file objects, with proper reference handling and minimal permitted audit metadata. Archiving is reversible and does not erase values. Permanent deletion is explicit and cannot be a generic bypass of tenant policy. Failed storage deletion needs retryable bookkeeping; do not announce completed erasure while objects remain.

Use encryption in transit and document at-rest encryption and key ownership as deployment responsibilities; never claim a compliance certification or encryption guarantees not implemented in the reference setup.

## 16. Working examples and development experience

Deliver two genuinely runnable examples, sharing engine code:

1. Minimal integration: create/publish/render/save/reopen/edit/history using real PostgreSQL and service routes.
2. Workspace/project host: parent default, child override, pinned/latest binding, protected profile fields, backend options, conditions, files and tenant/member/owner permission boundaries.

The second can be the primary reference application. Include at least two isolated tenants/workspaces, more than one user, an authorized collaborator, and an outsider. Use deterministic demo identities through a clearly development-only host login/session implementation; do not treat browser-chosen identity headers as production authentication. Keep demo accounts out of production seeds.

Examples must persist across page refresh and service restart. Neither localStorage nor JSON fixture files substitute for engine persistence. Browser storage may hold recoverable unsaved edits, with privacy controls, but not masquerade as the database.

Provide an example server validator returning field errors, dependent source lookup, unavailable/archived option behavior and source retry. Keep fault injection in tests or development-only review controls; never mix it with consumer form data.

Supply `.env.example`, Docker Compose for reference infrastructure, explicit migrate/seed/start commands, verification commands and reset instructions scoped to development data. Do not embed secrets. A developer should not need a paid cloud account to try the reference path.

Build packed npm artifacts and install them into a separate consumer fixture. Verify runtime behavior, exports/types/assets, provider compatibility and server/client separation using the actual artifacts. Workspace success alone is insufficient.

## 17. Documentation and public-consumption readiness

Write accurate tested instructions, not only plans:

- Quick start and environment/tool compatibility.
- Package installation, exports, provider/theme setup and backend mounting.
- Database initialization, migration status, supported upgrade paths and recovery.
- Minimal and workspace/project integration walkthroughs with frontend AND matching backend policy enforcement.
- Private versus shared forms, parent defaults/overrides, latest versus pinned bindings and IDs versus permissions.
- Registered sources/conditions/validators, safe regex and lifecycle hook contracts.
- Blank/saved/draft/compact rendering, field errors, retries/concurrency and protected values.
- Uploads/storage/access, cleanup, retention and erasure.
- Publication, history, definition comparison, record comparison and explicit migration.
- Duplicate, export/import format and dependency reconciliation.
- API/OpenAPI reference, troubleshooting and accessibility responsibilities.
- TrackForge integration guide covering workspace/project bindings and task association/mapping. Explain managed supplemental record storage versus host-owned task fields; do not imply arbitrary task edits are atomically saved by this engine.

Prepare public documentation content suitable for CoderLifeNet, organized with examples and navigation, but do not modify or publish coderlife.net during this sprint.

Document tested constraints and limitations honestly. Keep roadmap, decisions, README and package READMEs aligned with delivered behavior. Do not mark automated testing as human review. License selection remains owner-controlled; use honest unlicensed/private publication guards until a license is chosen. Licensing must not stop local development, but prevents claims of public publish readiness.

## 18. Versioning and release boundaries

Remain on `0.x.x`. Use `0.1.0` as the internal first-working-version candidate if no current repository version supersedes it; do not downgrade an existing version. This is not authorization to publish a release.

No automatic major increments. Chris must explicitly approve `1.0.0` and all later major versions. Breaking changes during pre-1.0 require deliberate minor progression, compatibility notes and migrations, not a major bump. Do not bump versions per commit.

Keep package versions coherent with VERSION/changelog. Choose a simple lockstep candidate version for this first workspace unless existing tooling requires another documented scheme. No fake release tags, npm publishing, production deployment or migration. Release tooling must default to validation/packing and require explicit publication; conventional commits cannot override major approval.

## 19. Required acceptance evidence

Implement meaningful automated tests at appropriate layers and record exact commands/results. Use actual PostgreSQL and object storage for integration tests. Mocked unit tests supplement rather than replace these checks.

| ID | Scenario that must pass |
| --- | --- |
| A01 | Fresh documented setup builds packages, migrates/seeds reference infrastructure and starts the host examples. |
| A02 | Author creates a grid form, configures properties/tooltip/validation/conditions, moves fields by pointer and keyboard, saves, reloads and sees the same draft. |
| A03 | Publishing validates on server and produces an immutable definition; concurrent draft/publication attempts cannot corrupt it. |
| A04 | A blank form receives trusted profile values and backend options; option refresh never resets saved selections/defaults. |
| A05 | Blur/local and server field errors appear accessibly on correct fields; failed submits preserve entries. |
| A06 | Submission persists across refresh/restart; editing produces exactly one new revision with its exact definition. |
| A07 | Version changes rename/archive/remove fields/options and add required fields; old history retains original meaning and old-record editing follows explicit policy. |
| A08 | Explicit record migration previews differences/errors and creates a new revision only after validation; cross-version comparisons are intelligible. |
| A09 | Inherited workspace form, project override, latest/pinned binding and reset behavior work; parent updates cannot rewrite historical configuration. |
| A10 | Outsider/other-tenant forged requests cannot load, save, publish, export, resolve sources, read history, attach files or download objects. Authorized collaborators work according to host policy. |
| A11 | Lost mutation responses and duplicate retries create one result; changed payload with same key fails; cached replay rechecks permissions. |
| A12 | Conflicts, session expiry, revoked permissions, network failures and stale async source results preserve safe state and produce truthful recovery. |
| A13 | Single/multiple uploads enforce content/size/count restrictions; completion/download authorization, retry/cancel, orphan cleanup and historical references work. |
| A14 | Duplicate/import allocate fresh identities, remap all internal references, preserve behavior and cannot change source forms. |
| A15 | Replacement import preserves destination placement/old records, validates before replacing, and blocks publication until capability dependencies are deliberately reconciled. |
| A16 | Export omits runtime records/secrets; malformed/oversized/unsupported/polluting imports and unsafe patterns are rejected. |
| A17 | Compact capture cannot bypass requiredness/server validation; omitted field errors are actionable without exposing unauthorized fields. |
| A18 | Archive/restore and authorized retention/erasure work, including file cleanup and failure recovery. |
| A19 | Fresh install plus meaningful sequential schema upgrade preserve supported historical data and expose migration status/failure behavior. |
| A20 | Packed-package external consumer fixture works without importing workspace source or server code into the browser. |
| A21 | Automated accessibility checks and keyboard/focus/responsive manual developer checks run across builder, capture, dialogs/history at desktop and narrow widths. Human review remains pending until a human reviews. |
| A22 | Minimal and workspace/project example guides are executed as written; documentation matches actual commands and APIs. |

Include schema/property tests, concurrency/transaction tests, lifecycle/source/regex limits and upload-security tests where they add coverage beyond these scenarios. Do not create superficial assertions just to claim a high test count. No hardcoded 100% coverage requirement at the expense of meaningful checks.

Use browser end-to-end tests and inspect rendered screens for clipping, overlays, mobile ordering and focus behavior. Run relevant tests during development and the final required suite after changes stabilize. Fix failures; do not delete requirements or skip tests to make the report green.

## 20. Completion report and stop conditions

Produce `docs/sprints/first-working-version-report.md` containing:

- What works and where the modules/examples/docs live.
- Completed task IDs and A01–A22 evidence with commands and results.
- Exact local start/setup/upgrade commands and example identities/purposes.
- Candidate package versions and packed artifacts/consumer-install evidence.
- Decisions made, material limitations and unresolved external blockers.
- Security/accessibility testing scope and what still needs human review.
- TrackForge integration next steps without changing TrackForge.
- Branch/commit details and publication/license status.

The final conversational report should be concise and point to these files. Do not mark the sprint complete with TODO handlers, no-op adapters, runtime mocks, nonfunctional icons, unsecured client-only permissions, fake migration scripts or broken package imports in the required path.

If an environment limitation prevents verification, distinguish implemented-but-unverified from tested work, give the exact blocker, and complete independent work. If runtime scope is incomplete, say so. Never substitute “ready for production” for evidence.

Begin with repository inspection and the task plan, then proceed directly through execution.
