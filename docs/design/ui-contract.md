# First working version — interface contract

Status: design reference for the end-to-end sprint; not evidence of runtime implementation or human-approved final styling.

Read with [the implementation prompt](../prompts/first-working-version.md) and [the interactive reference](form-studio-reference.html).

## Reference boundary

The HTML is an in-conversation visualization fragment with embedded local demonstration data. It is not a deployable application or production engine. It depends on the conversation's icon/tooltip runtime; do not treat its standalone icon rendering as a package dependency.

Its demo includes manager, builder, capture, records, record history, form versions and settings. Use these to understand placement and flow. Do not reuse in-memory persistence, hardcoded IDs/conditions, simulated API outcomes, file-name-only storage, simplified import checking or demo identity as runtime contracts. The sprint prompt requires the real implementation.

## Latest author preference

Secondary actions should generally use icons with short hover/focus/tap tooltips and accessible names. Import is labeled simply “Import.” Duplicate, export, archive/restore and import should not require icon-plus-text labels. Keep labeled primary calls to action where helpful: Create form, Publish, Submit, Save changes.

The manager's Import creates an independent form draft. Builder Import replaces the current draft, after validation and a specific confirmation, while preserving published versions/records. Explain the distinction in the dialog instead of a long toolbar label.

## Component boundary

Provide reusable views that can mount inside a host application. The reference's top navigation is a way to review all surfaces together; consumers do not need this exact application shell. Respondents do not see builder/manager controls.

## Manager

Compact searchable list with form name/description, published/draft/archived state, current version and permitted record count. Pagination and counts must reflect server permissions. Form name opens authoring. Row actions: duplicate, export, archive/restore; page actions: import and create.

Creation offers blank or bundled starter definitions without requiring a template catalog. Duplicate asks for the new name and produces an independent draft with new internal identities and no records.

Empty, loading, filtered-empty, permission and failed-load states are explicit. Archive preserves history; permanent erasure is separate.

## Builder

Desktop layout: narrow field palette, dominant central canvas, selected-field properties. Narrow screens reflow these panels with reachable navigation/focus; do not shrink inputs to unreadable sizes.

Canvas contains sections and rows with adjustable field widths, three to five fields per row where appropriate. Palette supports click insertion and drag insertion; canvas supports moving existing fields. Show insertion markers. Accessible commands move earlier/later, to another row/section, and adjust widths. Section operations include add, rename and order.

Properties expose Basic, Data, Rules and Layout. Basic: label, visible help, supplemental tooltip, requiredness and type-appropriate placeholder. Data: value source/timing/default, manual versus registered choices, upload constraints. Rules: validation presets, safe advanced pattern testing, conditional visibility/requiredness/read-only/disabled, host-registered condition selection. Layout: width, section/row and order.

Sources are discoverable named application capabilities, not arbitrary URLs/code. Conditions use readable selectors rather than raw expressions. Configuration errors appear at the relevant setting.

Toolbar: draft status, icon-only reuse actions, Save draft, Preview and Publish. Unsaved/saving/saved/error/conflict are truthful. Navigating away preserves or deliberately discards unsaved work. Publication is explicit, validated and immutable.

## Preview and respondent form

Desktop/mobile preview, example host context and new/saved state can be author tools. Respondent rendering receives the real definition/context/value state without author navigation or simulation controls.

Outlined information icons beside labels open supplemental plain text on hover/focus/tap. Essential help is visible. Each invalid field has an outline, inline message and accessible association; validate on blur and attempted submission, with correction feedback. Server field errors use the same presentation.

Application-bound fields can show read-only names. Backend options and conditional dependencies have loading/error/retry states. Requiredness does not disappear because a field is omitted/disabled. Files have real progress, per-file actions and safe retained references.

Full/compact, empty, incomplete saved draft, record edit, read-only and history are separate supported modes. Failed saves preserve values and safely resumable files. Completion creates a server-backed record or new revision, not a local status banner alone.

## Records and history

Record list shows meaningful title/summary, exact assigned form version and latest revision. Actions open read-only details, edit or history as permitted. Use application-neutral labels; sample service-request titles are not a core domain model.

History has a revision selector and saved values using that revision's immutable definition, labels/options and files. Compare selected revisions, including different form versions. Separate form-definition comparison from record-value comparison. Migration is an explicit preview/validation/commit flow; it does not happen automatically on edit.

## Versions and settings

Versions show current publication, change summary and immutable details; compare definitions or create a new draft from an earlier version. Restoring never mutates an old publication.

Settings show form identity, scoped usage, configuration source, parent inheritance/override/reset and authorized latest/pinned selection. Host access-policy summaries are informative; they are not frontend permission grants. Generic host scope labels can represent a workspace/project without hardcoding them into the engine.

Reuse controls are available here as well. Replacement import validates before altering the draft, explains preservation of existing records, and reconciles missing dependencies before publication.

## Review-only exclusions

Do not ship “Design concept,” “Design review only,” simulated response/source selectors, reset sample workspace, hardcoded sample identities, canned record data or local-only saving as production UI/schema features. Isolated tests/examples may contain clearly labeled equivalents.

The visual pulse/haptic idea is optional, never the only error cue. Reduced motion and device support apply.

## Verification

Check layout and all states at desktop and narrow widths, keyboard alternatives, focus restoration, tooltip dismissibility, screen-reader relationships/announcements, error preservation and permissions. Automated accessibility checks supplement manual developer checks. Human-reviewed status remains pending until a human explicitly reviews the completed implementation.
