# Published UI integration and verification

This internal form-engine candidate uses exactly `@coderlifenet/ui-core@0.2.0-alpha.0`
and `@coderlifenet/ui-components@0.2.0-alpha.0`. Do not install `latest`, which currently
selects the older core release. Registry metadata was inspected for both exact versions.
The installed peer stack is React/React DOM 19.2.8, MUI 9.4.0, Emotion React 11.14.0,
and Emotion Styled 11.14.1. Specialized ui-components exports are checked by the
external consumer; the default form controls use ui-core.

Core schemas, versions and persistence do not import React or either UI library.
`form-core/src/ui-event-catalog.ts` is a versioned data snapshot of the published
catalog. The external consumer checks it against the actual installed catalog.

## One host runtime

Both example `AnalyticsHost.tsx` files demonstrate a single host-owned runtime,
memory adapter and `UIExtensionsProvider`. Delivery starts disabled, with consent
denied. Enablement and consent controls update the existing runtime. Embedded
builders/renderers never create an additional provider; both `App.tsx` files
intentionally rely on the outer host composition from `main.tsx`.
A host may provide its
own MUI theme; shared components do not install another theme or global reset.

`apps/example-minimal/src/analytics-host.test.tsx` verifies the real
`<AnalyticsHost><App /></AnalyticsHost>` composition for delivery/consent gating:
disabled delivery blocks events, enabled+denied consent blocks events,
enabled+granted consent delivers selected events, and revoking consent stops
subsequent delivery.

Persisted form/field configuration uses `tracking`:

```json
{
  "id": "generated-tracking-scope",
  "semanticId": "request-title-control",
  "optOut": false,
  "events": ["ui.text_field.blur"],
  "metadata": { "surface": "capture", "kind": "text" }
}
```

A missing form tracking configuration opts the rendered form out. Field settings
inherit through ui-core boundaries. Undefined `events` inherits library defaults;
`[]` disables all events. Nested selections intersect and ancestor opt-out wins.
High-volume input events require explicit selection at every configured ancestor.
Only published catalog events can be selected. Metadata is static primitives,
never values, labels, filenames, URLs, business identifiers or expressions.
Custom host event families are not added to this author-facing catalog.

The builder's form settings and field Settings tab configure consumer-form
tracking, not analytics of the author editing the definition. Authoring controls
inherit the host's authoring scope. Independent copies receive new generated
tracking IDs; explicit semantic IDs are retained as deliberate classifications.

Inspect the example memory adapter with `memory.read()` and `memory.readContext()`;
these contain content-free events and their separate scope context. Production
hosts supply consent and adapters rather than relying on demo switches.

## Accessibility

Persisted `accessibility` provides optional label, description and instructions.
Visible labels remain the default. Renderer-generated instance IDs connect inputs,
helper text and errors without colliding when forms are embedded together. Required,
invalid, keyboard and focus behavior remain mandatory. No accessibility provider or
compliance toggle exists. Help icons use hover/focus/click tooltips.

Run `npm run test:browser` after `npx playwright install chromium`. The isolated UI
fixture exercises manager, builder, renderer and history at 1440 and 390 pixels,
using normal clicks plus keyboard focus checks and axe WCAG 2.2 AA tags. It uses
in-memory callbacks specifically for UI testing; it is not API/DB acceptance.
Human review, richer dialog coverage, custom themes and assistive-technology
verification are still required. Automated checks do not certify compliance.

## Draft continuity

Autosave defaults to a 1000 ms debounce. Saves are serialized; newer edits remain
unsaved until their own snapshot succeeds. `autosaveDelay={false}` disables it.
`onSaved` fires after a successful manual save with no newer pending edits; hosts
own navigation. The workspace example returns to Manager. Both examples keep the
active builder mounted while changing views. Embedded hosts can use
`onDefinitionChange` to maintain their own draft cache. A changed form ID resets
the editor; failed saves preserve edits. Reload restores database-saved edits,
not unsaved local state. Leaving with pending changes triggers a browser warning.

## Sources, files and verification limits

`optionSourceResolver` receives values and an AbortSignal. Refresh preserves
selection IDs; canceled/stale responses cannot overwrite newer results. Missing
options remain visible as unavailable saved selections. Historical views never
fetch sources. Source fields declare `kind` and optional `dependsOn` field IDs.

`createHttpUploadHandler(apiBase, formId, definitionId)` supplies authenticated
XHR progress/cancel handling. Examples submit completed upload IDs. File fields
support retry/removal; unattached objects expire through host-triggered cleanup.
Content signatures currently cover PNG, JPEG, PDF and plain text; this is not
malware scanning. Full quarantine/scanner and upload-idempotency work is unfinished.

`npm run pack:artifacts && npm run verify:consumer` now installs real form tarballs
in a temporary independent directory with the exact registry UI pair, compiles a
consumer TSX fixture, checks catalog parity and runs SSR imports/theme rendering.
It no longer passes merely because tarball files exist.

## API errors and safe retries

The browser-only `createFormApiClient` export from `@coderlifenet/form-react`
retains HTTP status, API error code and field errors in `FormRequestError`.
The renderer maps field errors back to their inputs and preserves entered values.
Hosts own authentication, authorization recovery, credentials and CSRF headers.
Use one `createMutationRetryKey()` instance per submission flow: call
`keyFor(serializedPayload)` for the idempotency header and `committed()` only after
success. Lost responses retain the key; changed payloads receive a new key.
The examples demonstrate this without placing transport in framework-independent
contracts. Submission controls are disabled while the save is pending.

## Test profiles

`npm test` uses fixture data and mocked dependencies. Database suites are skipped,
even when the application's `FORM_DB_URL` is present. Browser checks use the
isolated UI fixture, with no database or production service.

`FORM_TEST_DB_URL=postgres://.../formbuilder_test npm run test:integration` is an
explicit SQL/API integration profile. It connects to an existing dedicated test
database and never starts Docker. It must not target an application or production
database: these tests write fixtures and exercise migrations and erasure.
Mocks cannot verify real SQL constraints, rollback or locking; those checks remain
separate from everyday development tests.
