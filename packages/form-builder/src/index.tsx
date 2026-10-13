import { TrackingEditor, AccessibilityEditor } from "./settings.js";
import { DragEvent, ReactElement, useEffect, useMemo, useState, useRef } from "react";
import { copyDefinition, parsePortableJson, createStableId, FormDefinition, validateDefinition } from "@coderlifenet/form-core";
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from "@coderlifenet/ui-core";

export type ManagedForm = {
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  publishedVersion?: number;
  hasDraft: boolean;
  definition: FormDefinition;
};

type BuilderTab = "basic" | "data" | "rules" | "layout" | "settings";
type SaveState = "saved" | "saving" | "publishing" | "unsaved" | "error";
type Field = FormDefinition["fields"][number];

const paletteFields: Array<{ type: Field["type"]; label: string }> = [
  { type: "text", label: "Text" },
  { type: "multiline", label: "Long text" },
  { type: "number", label: "Number" },
  { type: "date", label: "Date" },
  { type: "checkbox", label: "Checkbox" },
  { type: "single_select", label: "Single select" },
  { type: "multi_select", label: "Multi select" },
  { type: "url", label: "URL" },
  { type: "single_file", label: "Single file" },
  { type: "multi_file", label: "Multiple files" }
];

export function FormManager(props: {
  forms: ManagedForm[];
  onOpenBuilder: (formId: string) => void;
  onCreateForm: () => void;
  onDuplicate: (formId: string) => void;
  onExport: (formId: string) => void;
  onArchiveToggle: (formId: string) => void;
  onImportAsNew: () => void;
}): ReactElement {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "archived">("all");

  const rows = useMemo(() => {
    return props.forms.filter((form) => {
      const nameMatch = form.name.toLowerCase().includes(query.toLowerCase());
      if (!nameMatch) {
        return false;
      }
      if (status === "draft") {
        return form.hasDraft;
      }
      if (status === "archived") {
        return form.archived;
      }
      return !form.archived;
    });
  }, [props.forms, query, status]);

  return (
    <Box component="section" aria-label="Form manager">
      <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" component="h2">Forms</Typography>
          <Typography variant="body2" color="text.secondary">Design once, publish immutable versions.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button aria-label="Import" title="Import" type="button" variant="outlined" onClick={props.onImportAsNew}>
            Import
          </Button>
          <Button type="button" variant="contained" onClick={props.onCreateForm}>Create form</Button>
        </Stack>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search forms"
          label="Search"
          size="small"
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="form-manager-status-label">Status</InputLabel>
          <Select
            labelId="form-manager-status-label"
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | "draft" | "archived")}
          >
            <MenuItem value="all">Active</MenuItem>
            <MenuItem value="draft">With draft</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <Box component="ul" sx={{ mt: 2, listStyle: "none", p: 0, m: 0 }}>
        {rows.map((form) => (
          <Paper
            key={form.id}
            component="li"
            variant="outlined"
            sx={{ p: 1.25, mb: 1, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 1, alignItems: "center" }}
          >
            <Button type="button" variant="text" sx={{ justifyContent: "flex-start" }} onClick={() => props.onOpenBuilder(form.id)}>
              {form.name}
            </Button>
            <Chip
              size="small"
              label={
                form.archived
                  ? "Archived"
                  : form.publishedVersion
                    ? `Published v${form.publishedVersion}${form.hasDraft ? " + draft" : ""}`
                    : "Draft"
              }
            />
            <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
              <Tooltip title="Duplicate">
                <IconButton aria-label="Duplicate" type="button" size="small" onClick={() => props.onDuplicate(form.id)}>
                  ⧉
                </IconButton>
              </Tooltip>
              <Tooltip title="Export">
                <IconButton aria-label="Export" type="button" size="small" onClick={() => props.onExport(form.id)}>
                  ⭳
                </IconButton>
              </Tooltip>
              <Tooltip title={form.archived ? "Restore" : "Archive"}>
                <IconButton
                  aria-label={form.archived ? "Restore" : "Archive"}
                  type="button"
                  size="small"
                  onClick={() => props.onArchiveToggle(form.id)}
                >
                  {form.archived ? "↺" : "🗄"}
                </IconButton>
              </Tooltip>
            </Stack>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

export function FormBuilder(props: {
  initialDefinition: FormDefinition;
  onSaveDraft: (definition: FormDefinition) => Promise<void> | void;
  onPublish: (definition: FormDefinition) => Promise<void> | void;
  onSaved?: () => void;
  onReloadDraft?: () => Promise<FormDefinition>;
  autosaveDelay?: number | false;
  sourceCapabilities?: Record<string, string>;
  onDefinitionChange?: (definition: FormDefinition) => void;
}): ReactElement {
  const [definition, setDefinition] = useState<FormDefinition>(props.initialDefinition);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(props.initialDefinition.fields[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<BuilderTab>("basic");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveMessage, setSaveMessage] = useState("");
  const latest = useRef(definition);
  latest.current = definition;
  const callbacks = useRef(props);
  callbacks.current = props;
  const savedSnapshot = useRef(JSON.stringify(props.initialDefinition));
  const queue = useRef<Promise<void>>(Promise.resolve());
  const formId = useRef(definition.metadata.formId);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);

  useEffect(() => {
    formId.current = props.initialDefinition.metadata.formId;
    savedSnapshot.current = JSON.stringify(props.initialDefinition);
    setDefinition(props.initialDefinition);
    setSelectedFieldId(props.initialDefinition.fields[0]?.id ?? null);
    setSaveState("saved");
    setSaveMessage("");
  }, [props.initialDefinition.metadata.formId]);

  const selectedField = definition.fields.find((field) => field.id === selectedFieldId) ?? null;
  const sectionChoices = definition.sections;

  const setDirty = (): void => {
    setSaveState("unsaved");
    if (saveMessage) {
      setSaveMessage("");
    }
  };

  const updateDefinition = (updater: (prev: FormDefinition) => FormDefinition): void => {
    setDefinition((prev) => updater(prev));
    setDirty();
  };

  const updateSelectedField = (updater: (field: Field) => Field): void => {
    if (!selectedFieldId) {
      return;
    }

    updateDefinition((prev) => ({
      ...prev,
      fields: prev.fields.map((field) => (field.id === selectedFieldId ? updater(field) : field))
    }));
  };

  const addField = (type: Field["type"]): void => {
    const id = createStableId("field");
    const sectionId = definition.sections[0]?.id ?? createStableId("section");
    const newField: Field = {
      id,
      key: id,
      type,
      label: defaultLabelByType(type),
      required: false,
      sectionId,
      row: definition.fields.length,
      width: type === "single_file" || type === "multi_file" || type === "multiline" ? 12 : 6,
      rules: [],
      ...(type === "single_select" || type === "multi_select"
        ? {
            options: [
              { id: createStableId("option"), label: "Option A" },
              { id: createStableId("option"), label: "Option B" }
            ]
          }
        : {})
    };

    updateDefinition((prev) => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));

    setSelectedFieldId(id);
    setActiveTab("basic");
  };

  const moveField = (fieldId: string, direction: -1 | 1): void => {
    updateDefinition((prev) => {
      const index = prev.fields.findIndex((field) => field.id === fieldId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.fields.length) {
        return prev;
      }

      const next = [...prev.fields];
      const [current] = next.splice(index, 1);
      next.splice(target, 0, current);
      return { ...prev, fields: next.map((field, idx) => ({ ...field, row: idx })) };
    });
  };

  const moveFieldToIndex = (fieldId: string, targetIndex: number): void => {
    updateDefinition((prev) => {
      const index = prev.fields.findIndex((field) => field.id === fieldId);
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.fields.length || index === targetIndex) {
        return prev;
      }

      const next = [...prev.fields];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, fields: next.map((field, idx) => ({ ...field, row: idx })) };
    });
  };

  const removeField = (fieldId: string): void => {
    updateDefinition((prev) => {
      const filteredFields = prev.fields
        .filter((field) => field.id !== fieldId)
        .map((field, index) => ({
          ...field,
          row: index,
          source: field.source ? { ...field.source, dependsOn: field.source.dependsOn?.filter(id => id !== fieldId) } : undefined,
          rules: field.rules.filter((rule) => rule.sourceFieldId !== fieldId)
        }));
      return { ...prev, fields: filteredFields };
    });

    setSelectedFieldId((current) => (current === fieldId ? definition.fields.find((field) => field.id !== fieldId)?.id ?? null : current));
  };

  const addSection = (): void => {
    const newSectionId = createStableId("section");
    updateDefinition((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: newSectionId,
          title: `Section ${prev.sections.length + 1}`,
          order: prev.sections.length
        }
      ]
    }));
  };

  const updateSelectOptions = (multiline: string): void => {
    const labels = multiline
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    updateSelectedField((field) => {
      const oldByLabel = new Map((field.options ?? []).map((option) => [option.label, option.id]));
      return {
        ...field,
        options: labels.map((label) => ({
          id: oldByLabel.get(label) ?? createStableId("option"),
          label
        }))
      };
    });
  };

  const addRule = (): void => {
    if (!selectedField) {
      return;
    }

    const sourceFieldId = definition.fields.find((field) => field.id !== selectedField.id)?.id;
    if (!sourceFieldId) {
      return;
    }

    updateSelectedField((field) => ({
      ...field,
      rules: [
        ...field.rules,
        {
          id: createStableId("rule"),
          behavior: "visible",
          sourceFieldId,
          operator: "equals",
          value: ""
        }
      ]
    }));
  };

  const removeRule = (ruleId: string): void => {
    updateSelectedField((field) => ({
      ...field,
      rules: field.rules.filter((rule) => rule.id !== ruleId)
    }));
  };

  const updateRule = (
    ruleId: string,
    updater: (rule: Field["rules"][number]) => Field["rules"][number]
  ): void => {
    updateSelectedField((field) => ({
      ...field,
      rules: field.rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule))
    }));
  };

  const handleCanvasDrop = (event: DragEvent<HTMLButtonElement>, targetFieldId: string): void => {
    event.preventDefault();
    if (!draggingFieldId || draggingFieldId === targetFieldId) {
      return;
    }

    const targetIndex = definition.fields.findIndex((field) => field.id === targetFieldId);
    if (targetIndex < 0) {
      return;
    }

    moveFieldToIndex(draggingFieldId, targetIndex);
    setDraggingFieldId(null);
  };

  const persist = (publish: boolean, manual: boolean): Promise<void> => {
    const requestedForm = formId.current;
    const operation = queue.current.catch(() => undefined).then(async () => {
      if (requestedForm !== formId.current) return;
      const snapshot = latest.current;
      const serialized = JSON.stringify(snapshot);
      setSaveState(publish ? "publishing" : "saving");
      try {
        if (publish) await callbacks.current.onPublish(snapshot);
        else if (serialized !== savedSnapshot.current || manual) await callbacks.current.onSaveDraft(snapshot);
        if (requestedForm !== formId.current) return;
        savedSnapshot.current = serialized;
        const current = JSON.stringify(latest.current) === serialized;
        setSaveState(current ? "saved" : "unsaved");
        setSaveMessage(publish ? "Published successfully" : "Draft saved");
        if (manual && current) callbacks.current.onSaved?.();
      } catch (error) {
        if (requestedForm !== formId.current) return;
        setSaveState("error");
        setSaveMessage(error instanceof Error ? error.message : "Save failed. Your edits remain available.");
      }
    });
    queue.current = operation;
    return operation;
  };
  const saveDraft = () => persist(false, true);
  const publishDraft = () => persist(true, false);
  useEffect(() => {
    callbacks.current.onDefinitionChange?.(definition);
    if (JSON.stringify(definition) === savedSnapshot.current || props.autosaveDelay === false) return;
    const timer = setTimeout(() => void persist(false, false), props.autosaveDelay ?? 1000);
    return () => clearTimeout(timer);
  }, [definition, props.autosaveDelay]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== savedSnapshot.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return (
    <Box component="section" aria-label="Form builder">
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5" component="h2">Builder</Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography role="status" aria-live="polite" variant="body2" color={saveState === "error" ? "error" : "text.secondary"}>
            Status: {saveState}{saveMessage ? ` - ${saveMessage}` : ""}
          </Typography>
          {saveState === "error" && props.onReloadDraft && <Button onClick={async () => {
            if (!window.confirm("Load the current saved draft and discard your local edits?")) return;
            try {
              const current = await props.onReloadDraft!();
              savedSnapshot.current = JSON.stringify(current);
              latest.current = current;
              setDefinition(current);
              setSaveState("saved");
              setSaveMessage("Saved draft loaded");
            } catch { setSaveMessage("Could not reload. Your local edits remain available."); }
          }}>Reload saved draft</Button>}
          <Button type="button" variant="outlined" disabled={saveState === "saving" || saveState === "publishing"} onClick={() => void saveDraft()}>
            Save draft
          </Button>
          <Button type="button" variant="contained" disabled={saveState === "saving" || saveState === "publishing"} onClick={() => void publishDraft()}>
            Publish
          </Button>
        </Stack>
      </Stack>
      <Box component="details" sx={{ mt: 2 }}>
        <Box component="summary">Form tracking and accessibility</Box>
        <Stack spacing={2} sx={{ p: 2 }}>
          <TrackingEditor form value={definition.tracking} onChange={tracking => updateDefinition(prev => ({ ...prev, tracking }))} />
          <Typography variant="subtitle2">Capability dependencies</Typography>
          {Object.entries(definition.dependencyVersions).map(([id, version]) => <Stack key={id} direction="row" spacing={1}><Typography>{id} ({version}){props.sourceCapabilities?.[id] === version ? "" : " — unavailable or incompatible"}</Typography><Button disabled={definition.fields.some(field => field.source?.id === id)} onClick={() => updateDefinition(previous => { const dependencyVersions = { ...previous.dependencyVersions }; delete dependencyVersions[id]; return { ...previous, dependencyVersions }; })}>Remove declaration</Button></Stack>)}
          <Typography variant="caption">Reconnect or remove field sources in Data settings. Publication remains blocked while dependencies are unresolved.</Typography>
          <AccessibilityEditor value={definition.accessibility} onChange={accessibility => updateDefinition(prev => ({ ...prev, accessibility }))} />
        </Stack>
      </Box>
      <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "180px minmax(0,1fr) 320px" }, gap: 1.5 }}>
        <Paper component="aside" variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6">Palette</Typography>
            <Button type="button" size="small" variant="text" onClick={addSection}>Add section</Button>
          </Stack>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {paletteFields.map((field) => (
              <Button key={field.type} type="button" variant="outlined" onClick={() => addField(field.type)}>
                {field.label}
              </Button>
            ))}
          </Stack>
        </Paper>

        <Paper component="main" variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="h6">Layout</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Drag fields to reorder. Keyboard: Alt+ArrowUp/Down moves; Alt+ArrowLeft/Right changes width.
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 1 }}>
            {definition.fields.map((field) => (
              <Button
                key={field.id}
                draggable
                type="button"
                variant={selectedFieldId === field.id ? "contained" : "outlined"}
                sx={{
                  gridColumn: `span ${field.width}`,
                  textAlign: "left",
                  justifyContent: "flex-start",
                  p: 1,
                  minHeight: 76,
                  overflow: "hidden"
                }}
                onDragStart={() => setDraggingFieldId(field.id)}
                onDragEnd={() => setDraggingFieldId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleCanvasDrop(event, field.id)}
                onClick={() => setSelectedFieldId(field.id)}
                onKeyDown={(event) => {
                  if (!event.altKey) {
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveField(field.id, -1);
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveField(field.id, 1);
                  }
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    updateDefinition((prev) => ({
                      ...prev,
                      fields: prev.fields.map((candidate) =>
                        candidate.id === field.id ? { ...candidate, width: Math.max(1, candidate.width - 1) } : candidate
                      )
                    }));
                  }
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    updateDefinition((prev) => ({
                      ...prev,
                      fields: prev.fields.map((candidate) =>
                        candidate.id === field.id ? { ...candidate, width: Math.min(12, candidate.width + 1) } : candidate
                      )
                    }));
                  }
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Typography>
                  <Typography variant="caption" color="inherit" sx={{ display: "block" }}>
                    {previewByType(field)}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Box>
        </Paper>

        <Paper component="aside" variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h6">Properties</Typography>
            {selectedField ? (
              <Tooltip title="Remove field">
                <IconButton aria-label="Remove field" size="small" color="error" onClick={() => removeField(selectedField.id)}>
                  ✕
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>

          {!selectedField ? (
            <Typography variant="body2" color="text.secondary">Select a field to edit configuration.</Typography>
          ) : (
            <>
              <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1, flexWrap: "wrap" }}>
                {(["basic", "data", "rules", "layout", "settings"] as BuilderTab[]).map((tab) => (
                  <Button
                    key={tab}
                    type="button"
                    size="small"
                    variant={activeTab === tab ? "contained" : "outlined"}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab[0].toUpperCase() + tab.slice(1)}
                  </Button>
                ))}
              </Stack>

              {activeTab === "settings" ? <Stack spacing={2}>
                <TrackingEditor key={selectedField.id} value={selectedField.tracking} onChange={tracking => updateSelectedField(field => ({ ...field, tracking }))} />
                <AccessibilityEditor value={selectedField.accessibility} onChange={accessibility => updateSelectedField(field => ({ ...field, accessibility }))} />
              </Stack> : null}
              {activeTab === "basic" ? (
                <Stack spacing={1.25}>
                  {(selectedField.type === "single_file" || selectedField.type === "multi_file") && <Stack spacing={1}>
                    <TextField label="Maximum bytes per file" type="number" value={selectedField.uploadPolicy?.maxBytes ?? 20971520} onChange={e => updateSelectedField(field => ({ ...field, uploadPolicy: { ...field.uploadPolicy, maxBytes: Number(e.target.value) } }))} />
                    <TextField label="Maximum files" type="number" value={selectedField.uploadPolicy?.maxFiles ?? (selectedField.type === "single_file" ? 1 : 100)} onChange={e => updateSelectedField(field => ({ ...field, uploadPolicy: { ...field.uploadPolicy, maxFiles: Number(e.target.value) } }))} />
                    <TextField label="Allowed media types (comma separated)" value={selectedField.uploadPolicy?.mediaTypes?.join(",") ?? ""} onChange={e => updateSelectedField(field => ({ ...field, uploadPolicy: { ...field.uploadPolicy, mediaTypes: e.target.value.split(",").map(type => type.trim()).filter(Boolean) } }))} />
                  </Stack>}
                  <TextField label="Label" value={selectedField.label} onChange={(event) => updateSelectedField((field) => ({ ...field, label: event.target.value }))} />
                  <TextField
                    label="Visible help text"
                    value={selectedField.helpText ?? ""}
                    onChange={(event) => updateSelectedField((field) => ({ ...field, helpText: event.target.value || undefined }))}
                  />
                  <TextField
                    label="Tooltip text"
                    value={selectedField.tooltipText ?? ""}
                    onChange={(event) => updateSelectedField((field) => ({ ...field, tooltipText: event.target.value || undefined }))}
                  />
                  <TextField
                    label="Placeholder"
                    value={selectedField.placeholder ?? ""}
                    onChange={(event) => updateSelectedField((field) => ({ ...field, placeholder: event.target.value || undefined }))}
                  />
                  <FormControlLabel
                    control={<Switch checked={selectedField.required} onChange={(event) => updateSelectedField((field) => ({ ...field, required: event.target.checked }))} />}
                    label="Required"
                  />
                </Stack>
              ) : null}

              {activeTab === "data" ? (
                <Stack spacing={1.25}>
                  {selectedField.source && <>
                    <TextField select label="Source purpose" value={selectedField.source.kind ?? "value"} slotProps={{ select: { native: true } }} onChange={e => updateSelectedField(field => ({ ...field, source: { ...field.source!, kind: e.target.value as "value" | "options" } }))}><option value="value">Value</option><option value="options">Options</option></TextField>
                    <TextField label="Source dependency field IDs (comma separated)" value={selectedField.source.dependsOn?.join(",") ?? ""} onChange={e => updateSelectedField(field => ({ ...field, source: { ...field.source!, dependsOn: e.target.value.split(",").map(id => id.trim()).filter(Boolean) } }))} />
                  </>}
                  <TextField
                    label="Default value"
                    value={toEditableDefaultValue(selectedField.defaultValue)}
                    onChange={(event) => updateSelectedField((field) => ({ ...field, defaultValue: event.target.value || undefined }))}
                  />
                  <FormControl size="small">
                    <InputLabel id="field-source-label">Source</InputLabel>
                    <Select
                      labelId="field-source-label"
                      label="Source"
                      value={selectedField.source?.id ?? ""}
                      onChange={(event) => {
                        const nextId = String(event.target.value);
                        updateSelectedField((field) => ({
                          ...field,
                          source: nextId
                            ? {
                                id: nextId,
                                version: props.sourceCapabilities?.[nextId] ?? field.source?.version ?? "1",
                                mode: field.source?.mode ?? "display_only"
                              }
                            : undefined
                        }));
                      }}
                    >
                      <MenuItem value="">Manual entry</MenuItem>
                      {selectedField.source && !props.sourceCapabilities?.[selectedField.source.id] && <MenuItem value={selectedField.source.id}>{selectedField.source.id} (unavailable)</MenuItem>}
                      {Object.entries(props.sourceCapabilities ?? {}).map(([id, version]) => <MenuItem key={id} value={id}>{id} ({version})</MenuItem>)}
                    </Select>
                  </FormControl>

                  {selectedField.source ? (
                    <FormControl size="small">
                      <InputLabel id="field-source-mode-label">Population</InputLabel>
                      <Select
                        labelId="field-source-mode-label"
                        label="Population"
                        value={selectedField.source.mode}
                        onChange={(event) => {
                          const mode = event.target.value as NonNullable<Field["source"]>["mode"];
                          updateSelectedField((field) => ({
                            ...field,
                            source: field.source ? { ...field.source, mode } : field.source
                          }));
                        }}
                      >
                        <MenuItem value="manual">Manual</MenuItem>
                        <MenuItem value="create_only">Create only</MenuItem>
                        <MenuItem value="refresh_on_edit">Refresh on edit</MenuItem>
                        <MenuItem value="display_only">Display only</MenuItem>
                      </Select>
                    </FormControl>
                  ) : null}

                  {selectedField.type === "single_select" || selectedField.type === "multi_select" ? (
                    <TextField
                      multiline
                      minRows={4}
                      label="Options (one label per line)"
                      value={(selectedField.options ?? []).map((option) => option.label).join("\n")}
                      onChange={(event) => updateSelectOptions(event.target.value)}
                    />
                  ) : null}
                </Stack>
              ) : null}

              {activeTab === "rules" ? (
                <Stack spacing={1.25}>
                  <Typography variant="body2" color="text.secondary">Validation</Typography>
                  <TextField
                    type="number"
                    label="Min length"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={selectedField.validation?.minLength ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateSelectedField((field) => ({
                        ...field,
                        validation: {
                          ...(field.validation ?? {}),
                          minLength: value === "" ? undefined : Math.max(0, Number(value))
                        }
                      }));
                    }}
                  />
                  <TextField
                    type="number"
                    label="Max length"
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={selectedField.validation?.maxLength ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateSelectedField((field) => ({
                        ...field,
                        validation: {
                          ...(field.validation ?? {}),
                          maxLength: value === "" ? undefined : Math.max(1, Number(value))
                        }
                      }));
                    }}
                  />
                  <TextField
                    label="Regex"
                    value={selectedField.validation?.regex ?? ""}
                    onChange={(event) => updateSelectedField((field) => ({
                      ...field,
                      validation: {
                        ...(field.validation ?? {}),
                        regex: event.target.value || undefined
                      }
                    }))}
                  />
                  <TextField
                    label="Regex message"
                    value={selectedField.validation?.regexMessage ?? ""}
                    onChange={(event) => updateSelectedField((field) => ({
                      ...field,
                      validation: {
                        ...(field.validation ?? {}),
                        regexMessage: event.target.value || undefined
                      }
                    }))}
                  />

                  <Divider />
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">Conditional behavior</Typography>
                    <Button type="button" size="small" onClick={addRule}>Add condition</Button>
                  </Stack>

                  {selectedField.rules.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">No conditional rules.</Typography>
                  ) : null}

                  {selectedField.rules.map((rule) => (
                    <Paper key={rule.id} variant="outlined" sx={{ p: 1 }}>
                      <Stack spacing={1}>
                        <FormControl size="small">
                          <InputLabel id={`${rule.id}-behavior-label`}>Behavior</InputLabel>
                          <Select
                            labelId={`${rule.id}-behavior-label`}
                            label="Behavior"
                            value={rule.behavior}
                            onChange={(event) => updateRule(rule.id, (current) => ({ ...current, behavior: event.target.value as Field["rules"][number]["behavior"] }))}
                          >
                            <MenuItem value="visible">Visible</MenuItem>
                            <MenuItem value="required">Required</MenuItem>
                            <MenuItem value="readonly">Read-only</MenuItem>
                            <MenuItem value="disabled">Disabled</MenuItem>
                          </Select>
                        </FormControl>

                        <FormControl size="small">
                          <InputLabel id={`${rule.id}-source-label`}>When field</InputLabel>
                          <Select
                            labelId={`${rule.id}-source-label`}
                            label="When field"
                            value={rule.sourceFieldId}
                            onChange={(event) => updateRule(rule.id, (current) => ({ ...current, sourceFieldId: String(event.target.value) }))}
                          >
                            {definition.fields
                              .filter((field) => field.id !== selectedField.id)
                              .map((field) => (
                                <MenuItem key={field.id} value={field.id}>{field.label}</MenuItem>
                              ))}
                          </Select>
                        </FormControl>

                        <FormControl size="small">
                          <InputLabel id={`${rule.id}-operator-label`}>Operator</InputLabel>
                          <Select
                            labelId={`${rule.id}-operator-label`}
                            label="Operator"
                            value={rule.operator}
                            onChange={(event) => updateRule(rule.id, (current) => ({ ...current, operator: event.target.value as Field["rules"][number]["operator"] }))}
                          >
                            <MenuItem value="equals">Equals</MenuItem>
                            <MenuItem value="not_equals">Not equals</MenuItem>
                            <MenuItem value="empty">Is empty</MenuItem>
                            <MenuItem value="not_empty">Not empty</MenuItem>
                            <MenuItem value="includes_option">Includes option</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          size="small"
                          label="Value"
                          value={rule.value === undefined ? "" : String(rule.value)}
                          onChange={(event) => updateRule(rule.id, (current) => ({ ...current, value: event.target.value }))}
                        />

                        <Button type="button" color="error" size="small" onClick={() => removeRule(rule.id)}>Remove condition</Button>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              ) : null}

              {activeTab === "layout" ? (
                <Stack spacing={1.25}>
                  <TextField
                    type="number"
                    label="Desktop width (1-12)"
                    slotProps={{ htmlInput: { min: 1, max: 12 } }}
                    value={selectedField.width}
                    onChange={(event) => {
                      const width = Math.min(12, Math.max(1, Number(event.target.value) || 1));
                      updateSelectedField((field) => ({ ...field, width }));
                    }}
                  />

                  <FormControl size="small">
                    <InputLabel id="field-section-label">Section</InputLabel>
                    <Select
                      labelId="field-section-label"
                      label="Section"
                      value={selectedField.sectionId}
                      onChange={(event) => {
                        const sectionId = String(event.target.value);
                        updateSelectedField((field) => ({ ...field, sectionId }));
                      }}
                    >
                      {sectionChoices.map((section) => (
                        <MenuItem key={section.id} value={section.id}>{section.title}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    type="number"
                    label="Row"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={selectedField.row}
                    onChange={(event) => {
                      const row = Math.max(0, Number(event.target.value) || 0);
                      updateSelectedField((field) => ({ ...field, row }));
                    }}
                  />

                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Move earlier">
                      <span>
                        <IconButton aria-label="Move earlier" onClick={() => moveField(selectedField.id, -1)}>↑</IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move later">
                      <span>
                        <IconButton aria-label="Move later" onClick={() => moveField(selectedField.id, 1)}>↓</IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              ) : null}
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

export function exportDefinition(definition: FormDefinition): string {
  const validated = validateDefinition(definition);
  return JSON.stringify(
    {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      definition: validated,
      dependencies: validated.dependencyVersions
    },
    null,
    2
  );
}

export function importDefinition(json: string): FormDefinition {
  const parsed = parsePortableJson(json) as { definition: FormDefinition; dependencies?: Record<string, string> };
  if ((parsed as { formatVersion?: number }).formatVersion !== 1) throw new Error("UNSUPPORTED_IMPORT_VERSION");
  const validated = validateDefinition(parsed.definition);
  return remapDefinitionStableIds({
    ...validated,
    dependencyVersions: parsed.dependencies ?? validated.dependencyVersions
  });
}

function remapDefinitionStableIds(definition: FormDefinition): FormDefinition {
  return copyDefinition(definition);
}

function defaultLabelByType(type: Field["type"]): string {
  switch (type) {
    case "text":
      return "Text field";
    case "multiline":
      return "Long text";
    case "number":
      return "Number";
    case "date":
      return "Date";
    case "checkbox":
      return "Checkbox";
    case "single_select":
      return "Select one";
    case "multi_select":
      return "Select many";
    case "url":
      return "URL";
    case "single_file":
      return "File";
    case "multi_file":
      return "Files";
    default:
      return "Field";
  }
}

function previewByType(field: Field): string {
  if (field.source) {
    return `Source: ${field.source.id}`;
  }

  if (field.type === "single_select" || field.type === "multi_select") {
    return (field.options ?? []).map((option) => option.label).join(", ") || "No options";
  }

  if (field.type === "checkbox") {
    return "Toggle";
  }

  if (field.type === "single_file" || field.type === "multi_file") {
    return "File picker";
  }

  return field.placeholder || field.helpText || field.type;
}

function toEditableDefaultValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}
