# TrackForge integration boundary

This sprint changes only form-builder. TrackForge's ordinary operational inputs
can later adopt ui-core independently. This engine serves user-created workflow
forms, with managed supplemental records; it does not replace ordinary app forms
or atomically update arbitrary TrackForge task data.

Mount `createFormServer` with TrackForge's trusted session-to-tenant/actor adapter.
Implement `authorize(ctx, capability, resource)` using workspace membership and
project access. IDs supplied by the browser are selectors, never authorization.
Mount the React packages under TrackForge's existing MUI theme and single ui-core
analytics provider. Form authors choose tracking settings; host consent always wins.

## Generic scope bindings

`PUT /api/bindings/:scopeType/:scopeId` accepts:

```json
{"formId":"selected-form","mode":"latest","expectedRevision":0}
```

Use `mode: "pinned"` and an authorized `definitionId` to select a specific
publication. Revision 0 creates; updates require the returned revision. A stale
revision returns `BINDING_CONFLICT`. `DELETE` with `expectedRevision` removes the
child override. `GET` returns the effective source scope, mode, revision, form ID
and definition ID.

The host's `bindingAncestors(ctx, scope)` returns authorized ancestors root-first,
ending with the requested scope. The engine authorizes each returned scope and
selects the nearest explicit binding. Never accept a browser-supplied ancestor
chain. The demo host relates example-project to example-workspace only.

Include the resolved `binding` scopeType/scopeId/revision/definitionId in a new
record request to detect changed bindings/publications before submission. The
submitted definition is an immutable authorized snapshot; record history always
uses its stored definition ID. Binding edits never rewrite historical records.
The full example binding editor and concurrent-resolution DB checks remain pending.

## Sources and capability reconciliation

Register a trusted `SourceRegistry` with `capabilities(ctx)` returning source IDs
and exact versions, plus `resolveSourceValue(id, ctx, values)`. The design API lists
capabilities under author permission. Publication rejects unavailable/incompatible
field sources or dependency declarations. Reconnect/remove sources in the builder;
remove unused declarations explicitly in form settings.

Option requests use a published definition ID plus field ID, not arbitrary remote
URLs. The server resolves eligibility again during submission and saves selected
labels for historical recall. TrackForge supplies profile/options from its backend.
No engine code owns TrackForge's user, workspace or task models.

## Retention and schema upgrade

Run migrations before starting the updated server. `0002_storage_deletion_queue`
adds a durable erasure retry queue and binding revisions. Migration tests include
an isolated 0001-to-0002 upgrade preserving a published record.

Configure `retentionPolicy.pendingUploadMaxAgeMs` on the server and schedule an
authorized `POST /api/maintenance/storage-cleanup`. It expires only unattached
uploads and retries queued storage deletions. Record erasure responds 202 while
objects still need cleanup; 204 means its object deletions completed. Attached
uploads cannot be deleted through the standalone upload endpoint. Record-age
retention controls and the full shared-history reference lifecycle are unfinished.
