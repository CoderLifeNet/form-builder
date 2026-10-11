# Product requirements

## Scope and ownership

Build an end-to-end reusable form engine with npm distribution, provided database schemas/migrations, a default React interface, backend services, and documented integration. Consumers own their data, deployment, identity, and business logic. Keep the project independent of TrackForge Atlas.

Core schema, validation, versioning, and storage contracts must not depend on React, MUI, or CoderLife UI. Default React interfaces use verified @coderlifenet/ui-core and relevant ui-components. Generally useful primitives belong in the appropriate shared library; form behavior belongs here.

## Builder and layout

Support blank forms and starter templates, field palette, grid canvas, properties editor, preview, drafts, explicit publication, and version history.
Provide sections/groups, rows/columns, ordering and widths. Allow three to five fields per desktop row where readable; stack sensibly on mobile.
Drag-and-drop must have clear insertion indicators and keyboard alternatives for all operations. Moving a field must not change its identity or stored values.
Moving multiple selected fields is proposed later work, not required for the first builder.
Routine authoring must not expose JSON, database IDs, or schema jargon.

## Field properties

Initial types: text, multiline text, number, date, checkbox, single-select, multi-select, URL, and single/multiple file upload.
Each field has independent label, help text, optional placeholder, initial value, requiredness, validation, tooltip and layout settings as appropriate to its type.
Stable field and option identities are independent of labels. Presentation-only elements are not stored values.
Distinguish placeholder, initial/default value, host-bound value, computed/display value, and persisted value. Defaults never overwrite existing records.
Repeated collections and additional field types need an explicit scope decision.

An optional outlined information icon near the label reveals supplemental text on hover, keyboard focus, click or tap. Provide an accessible name and dismissible interaction. Essential instructions remain visible; they must not exist only in a tooltip.

## Validation and error feedback

Validate invalid fields on blur and all relevant fields on submit. Update local errors as users correct values; do not mark untouched fields invalid on initial display.
Use clear inline messages, error styling, accessible relationships and announcements. Preserve entered values and focus the first invalid field after failed submission.
Server field errors use stable field IDs, safe messages and machine-readable codes. Configuration errors belong in builder properties; record errors belong on respondent fields.
Errors for omitted fields must be actionable without revealing fields the user lacks permission to access.
Network, session, permission and conflict failures need distinct form-level recovery states. Retrying must not duplicate records.
Optional visual feedback respects reduced motion. Physical haptics are optional host capabilities and never the sole error signal.

Provide type-appropriate predefined constraints and configurable messages. Custom regex is in scope as an advanced authoring capability, but publication depends on a safe execution mechanism, bounded complexity and a pattern-test UI. Arbitrary executable expressions are prohibited.
Host-defined business validators are registered code, referenced by name.

## Intelligent fields and lifecycle integration

Expose value sources and behavior in the builder, not solely in developer APIs. Authors can select manual values or host-registered sources, population timing, visibility, requiredness, disabled/read-only states and conditions.
Use readable condition controls and a bounded declarative rule model. Host-registered programmatic conditions can also be selected.
Only expose authorized, compatible sources to authors. Definitions contain references and validated configuration, not credentials or executable code.

Hooks may prepare initial values, resolve options/selected items, react to dependencies, perform server validation and participate in saving. Define timing, authority, errors, cancellation, stale-response protection, and retry behavior before implementation.
Loading options must not reset selected values. Missing/archived selections require specific resolution or preserved unavailable labels.
Define create-only versus edit-refresh versus display-only population. Saved records must not be overwritten implicitly.
Read-only, disabled, hidden, omitted and excluded-from-save are distinct. Conditional state changes must not implicitly clear values or suspend requiredness.
Server-derived owner-controlled values cannot be trusted merely because the browser prevents editing.
Historical views must not fetch current data and substitute it for saved historical meaning.

## Files

Support one or multiple files, type restrictions, size limits, count limits, progress, cancellation, retry and per-file errors.
Provide storage adapter contracts and a tested reference setup. Store references/metadata; never put binary data in form definitions.
Server validation, upload completion, authorized downloads, abandoned-upload cleanup, removal, revision references, retention and erasure need defined policies. No browser-prefilled default files.
Do not silently add outbound integrations or webhooks.

## Definitions and records

Published definitions are immutable and include fields, options, rules, defaults, layout and behavior.
Record revisions are separate and reference their exact published definition. Preserve historical labels, selected-option meanings, structure and values.
No silent migration or retroactive enforcement of new rules. Explicitly design type changes, archived options, added required fields, editing old versions, record migration, definition reversion and cross-version comparison.
Historical layouts remain responsive and accessible without requiring old pixel-perfect styling.
Logical removal/archival is separate from authorized permanent erasure; retention can limit history.

## Inheritance and embedding

Support generic defaults, parent configuration and explicit child overrides through bindings. Show sources, overrides and reset actions.
Specify deterministic merge/replacement rules, parent changes, draft updates and reproducible historical resolution.
Provide full/compact capture, edit, read-only and history interfaces with consistent field identities and server validation. Compact capture cannot bypass requiredness; authorized server values, additional capture or incomplete record drafts must account for omitted required fields.

## Duplicate, export and import

Builder-only operations; respondent capture/edit interfaces do not expose them.
Duplicate creates an independent draft with fresh identities.
Export uses a versioned JSON definition with descriptive metadata and declared dependencies. Exclude submitted records, attachments, secrets, deployment identities and audit history.
Import-as-new allocates new form/field/option/layout identities and remaps internal references.
Replacement import replaces the destination builder draft with fresh definition identities, without attempting old-to-new field matching. Preserve the destination form identity/placement and all published versions/record history.
Validate and preview before replacing. Warn specifically about draft replacement. Publication is separate.
Unresolved sources/validators require reconnection or replacement; do not silently discard behavior.
A ready-made form repository/catalog is explicitly outside current scope.

## Service, security and quality

Provide server-authoritative publication and record validation, optimistic concurrency, idempotency, transactions, referential integrity, pagination with truthful counts, retrieval, archival, export/import validation and deletion.
Separate record revisions from security audit events.
Host authentication is optional; authorization is enforced for designers, publishers, submitters, readers, editors, history, exports and deletion. Anonymous submissions require an explicit server policy and do not expose records publicly.
Derive tenant, owner and audit identity from trusted context. Address tenant isolation, expired sessions, changed permissions, stale requests, CSRF where applicable and abuse/rate controls.
Sensitive values stay out of logs, analytics, URLs and errors. Document encryption/key ownership and host deployment responsibilities without certification claims.
Target WCAG 2.2 AA across builder, renderer, preview, dialogs and history: keyboard access, focus, names, announcements, reduced motion, contrast and touch targets.

## Distribution

Provide installable packages, initial and upgrade migrations, tested setup instructions and a working reference integration.
Publish public documentation on CoderLifeNet with quick-start npm README links, API reference, troubleshooting, compatibility and upgrade guides.

## Upload provider clarification — October 11, 2026

The engine must be storage-agnostic. Garage is the optional supplied Docker reference, not a mandatory runtime service. The revised initial scope includes private filesystem uploads and an S3-compatible adapter, with a documented custom-provider contract. No-file forms require no storage provider. See [file storage](file-storage.md) for responsibilities and acceptance checks.
