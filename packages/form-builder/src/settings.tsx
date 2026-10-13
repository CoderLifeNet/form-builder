import { useState } from "react";
import { trackingSettingsSchema, type TrackingSettings, type FormDefinition, createStableId } from "@coderlifenet/form-core";
import { TextField, Stack, FormControlLabel, Switch, Typography } from "@coderlifenet/ui-core";
import { knownUIEventTypes } from "@coderlifenet/ui-core/instrumentation";

export function TrackingEditor({ value, onChange, form = false }: { value?: TrackingSettings; onChange: (value: TrackingSettings) => void; form?: boolean }) {
  const [metadata, setMetadata] = useState(JSON.stringify(value?.metadata ?? {}));
  const [error, setError] = useState("");
  const update = (patch: Partial<TrackingSettings>) => onChange({ id: value?.id ?? createStableId("tracking"), ...value, ...patch });
  return <Stack spacing={1}>
    <Typography variant="subtitle2">Tracking</Typography>
    <FormControlLabel label={form ? "Enable form tracking" : "Opt out of field tracking"} control={<Switch checked={form ? Boolean(value && !value.optOut) : Boolean(value?.optOut)} onChange={(_, checked) => update({ optOut: form ? !checked : checked })} />} />
    <TextField label="Semantic tracking ID" value={value?.semanticId ?? ""} onChange={e => update({ semanticId: e.target.value || undefined })} />
    <TextField select label="Event selection" value={value?.events === undefined ? "inherit" : "selected"} onChange={e => update({ events: e.target.value === "inherit" ? undefined : [] })} slotProps={{ select: { native: true } }}><option value="inherit">Inherit defaults</option><option value="selected">Select events (none disables delivery)</option></TextField>
    {value?.events !== undefined && <TextField select label="Selected events" value={value.events} slotProps={{ select: { multiple: true, native: true } }} onChange={e => { const options = (e.target as unknown as HTMLSelectElement).selectedOptions; update({ events: Array.from(options).map(o => o.value) }); }}>{knownUIEventTypes.map(event => <option key={event} value={event}>{event}</option>)}</TextField>}
    <TextField label="Static metadata JSON" multiline value={metadata} error={Boolean(error)} helperText={error || "Classification only; never values, labels, URLs, file names, or business identifiers."} onChange={e => { setMetadata(e.target.value); try { const parsed = trackingSettingsSchema.parse({ id: value?.id ?? "preview", metadata: JSON.parse(e.target.value) }); update({ metadata: parsed.metadata }); setError(""); } catch { setError("Use a JSON object with primitive values."); } }} />
  </Stack>;
}
export function AccessibilityEditor({ value, onChange }: { value?: FormDefinition["accessibility"]; onChange: (value: NonNullable<FormDefinition["accessibility"]>) => void }) {
  return <Stack spacing={1}><Typography variant="subtitle2">Accessibility presentation</Typography>{(["label", "description", "instructions"] as const).map(key => <TextField key={key} label={`Accessible ${key}`} value={value?.[key] ?? ""} onChange={e => onChange({ ...value, [key]: e.target.value || undefined })} />)}</Stack>;
}
