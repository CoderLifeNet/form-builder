import { TrackingEditor, AccessibilityEditor } from "./settings.js";
import { DragEvent, ReactElement, useEffect, useMemo, useState, useRef } from "react";
import { copyDefinition, parsePortableJson, createStableId, FormDefinition, validateDefinition } from "@coderlifenet/form-core";
import {
  Alert,
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
const DRAG_FIELD_MIME = "application/x-coderlifenet-form-field";

const paletteFields: Array<{ type: Field["type"]; label: string }> = [
  { type: "text", label: "Text" },
  { type: "multiline", label: "Long text" },
  { type: "number", label: "Number" },
  { type: "date", label: "Date" },
  { type: "checkbox", label: "Checkbox" },
  { type: "single_select", label: "Dropdown" },
  { type: "radio", label: "Radio buttons" },
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
    <Box component="section" aria-label="Forms">
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
        <Box>
          <Typography variant="h5" component="h2">Forms</Typography>
          <Typography variant="body2" color="text.secondary">Create and manage reusable form designs. Publishing makes a locked version for new responses while older responses keep their original form.</Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button aria-label="Import form" title="Import form" type="button" variant="outlined" onClick={props.onImportAsNew}>
            Import form JSON
          </Button>
          <Button type="button" variant="contained" onClick={props.onCreateForm}>Create new form</Button>
        </Stack>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find by form name"
          label="Find form"
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
      {rows.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {query || status !== "all"
            ? "No forms match this filter. Clear filters or create a new form."
            : "No forms yet. Create a form to start designing and publishing versions."}
        </Alert>
      ) : null}
      <Box component="ul" sx={{ mt: 2, listStyle: "none", p: 0, m: 0 }}>
        {rows.map((form) => (
          <Paper
            key={form.id}
            component="li"
            variant="outlined"
            sx={{ p: 1.25, mb: 1, display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1fr) auto auto" }, gap: 1, alignItems: "center" }}
          >
            <Box>
              <Button type="button" variant="text" sx={{ justifyContent: "flex-start", px: 0.5 }} onClick={() => props.onOpenBuilder(form.id)}>
                {form.name}
              </Button>
              {form.description ? <Typography variant="body2" color="text.secondary">{form.description}</Typography> : null}
            </Box>
            <Chip
              size="small"
              sx={{ justifySelf: { xs: "flex-start", md: "auto" } }}
              label={
                form.archived
                  ? "Archived"
                  : form.publishedVersion
                    ? `Published v${form.publishedVersion}${form.hasDraft ? " with draft changes" : ""}`
                    : "Draft only"
              }
            />
            <Stack direction="row" spacing={0.5} sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}>
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
  const dragGhost = useRef<HTMLDivElement | null>(null);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dropTargetFieldId, setDropTargetFieldId] = useState<string | null>(null);
  const [dropTargetSectionId, setDropTargetSectionId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(props.initialDefinition.sections[0]?.id ?? null);
  const [pendingSectionRemovalId, setPendingSectionRemovalId] = useState<string | null>(null);
  const [sectionMoveTargetId, setSectionMoveTargetId] = useState<string | null>(null);

  const unresolvedDependencies = useMemo(() => {
    return Object.entries(definition.dependencyVersions)
      .map(([sourceId, expectedVersion]) => {
        const availableVersion = props.sourceCapabilities?.[sourceId];
        const affectedFields = definition.fields.filter((field) => field.source?.id === sourceId);
        return {
          sourceId,
          expectedVersion,
          availableVersion,
          affectedFields
        };
      })
      .filter((entry) => entry.availableVersion !== entry.expectedVersion);
  }, [definition.dependencyVersions, definition.fields, props.sourceCapabilities]);

  useEffect(() => {
    formId.current = props.initialDefinition.metadata.formId;
    savedSnapshot.current = JSON.stringify(props.initialDefinition);
    setDefinition(props.initialDefinition);
    setSelectedFieldId(props.initialDefinition.fields[0]?.id ?? null);
    setSelectedSectionId(props.initialDefinition.sections[0]?.id ?? null);
    setSaveState("saved");
    setSaveMessage("");
  }, [props.initialDefinition.metadata.formId]);

  useEffect(() => {
    if (!definition.sections.length) {
      setSelectedSectionId(null);
      return;
    }
    if (selectedField) {
      setSelectedSectionId(selectedField.sectionId);
      return;
    }
    if (!selectedSectionId || !definition.sections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(definition.sections[0].id);
    }
  }, [definition.sections, definition.fields, selectedFieldId, selectedSectionId]);

  const selectedField = definition.fields.find((field) => field.id === selectedFieldId) ?? null;
  const sectionChoices = definition.sections;
  const orderedSections = useMemo(
    () => [...definition.sections].sort((a, b) => a.order - b.order),
    [definition.sections]
  );
  const sectionFields = useMemo(() => {
    const map = new Map<string, Field[]>();
    for (const section of orderedSections) {
      map.set(
        section.id,
        definition.fields
          .filter((field) => field.sectionId === section.id)
          .sort((a, b) => a.row - b.row)
      );
    }
    return map;
  }, [definition.fields, orderedSections]);

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
    const sectionId = selectedSectionId ?? definition.sections[0]?.id ?? createStableId("section");
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
      ...(type === "single_select" || type === "radio" || type === "multi_select"
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
    setSelectedSectionId(sectionId);
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
    setSelectedSectionId(newSectionId);
    setSelectedFieldId(null);
  };

  const updateSectionTitle = (sectionId: string, title: string): void => {
    updateDefinition((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, title } : section
      )
    }));
  };

  const moveSection = (sectionId: string, direction: -1 | 1): void => {
    updateDefinition((prev) => {
      const sorted = [...prev.sections].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sorted.length) {
        return prev;
      }
      const next = [...sorted];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return {
        ...prev,
        sections: next.map((section, idx) => ({ ...section, order: idx }))
      };
    });
  };

  const moveFieldToSectionEnd = (fieldId: string, sectionId: string): void => {
    updateDefinition((prev) => {
      const index = prev.fields.findIndex((field) => field.id === fieldId);
      if (index < 0) {
        return prev;
      }
      const next = [...prev.fields];
      const [moved] = next.splice(index, 1);
      moved.sectionId = sectionId;
      const targetLastIndex = next.reduce((lastIndex, candidate, candidateIndex) => (
        candidate.sectionId === sectionId ? candidateIndex : lastIndex
      ), -1);
      const insertIndex = targetLastIndex < 0 ? next.length : targetLastIndex + 1;
      next.splice(insertIndex, 0, moved);
      return { ...prev, fields: next.map((field, idx) => ({ ...field, row: idx })) };
    });
  };

  const finalizeSectionRemoval = (sectionId: string, mode: "move" | "delete", targetSectionId?: string): void => {
    updateDefinition((prev) => {
      const remainingSections = prev.sections
        .filter((section) => section.id !== sectionId)
        .sort((a, b) => a.order - b.order)
        .map((section, idx) => ({ ...section, order: idx }));

      const nextFields = prev.fields
        .filter((field) => mode === "delete" ? field.sectionId !== sectionId : true)
        .map((field) => {
          if (mode === "move" && field.sectionId === sectionId && targetSectionId) {
            return { ...field, sectionId: targetSectionId };
          }
          return field;
        })
        .map((field, idx) => ({ ...field, row: idx }));

      return {
        ...prev,
        sections: remainingSections,
        fields: nextFields
      };
    });

    if (mode === "delete" && selectedField && selectedField.sectionId === sectionId) {
      const nextField = definition.fields.find((field) => field.sectionId !== sectionId);
      setSelectedFieldId(nextField?.id ?? null);
    }
    setSelectedSectionId(targetSectionId ?? orderedSections.find((section) => section.id !== sectionId)?.id ?? null);
    setPendingSectionRemovalId(null);
    setSectionMoveTargetId(null);
  };

  const requestSectionRemoval = (sectionId: string): void => {
    if (orderedSections.length <= 1) {
      setSaveMessage("At least one section is required.");
      return;
    }
    const fieldsInSection = (sectionFields.get(sectionId) ?? []).length;
    if (!fieldsInSection) {
      finalizeSectionRemoval(sectionId, "delete");
      return;
    }
    const target = orderedSections.find((section) => section.id !== sectionId)?.id ?? null;
    setPendingSectionRemovalId(sectionId);
    setSectionMoveTargetId(target);
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
    setDropTargetFieldId(null);
    setDropTargetSectionId(null);
    const draggedFieldId = event.dataTransfer.getData(DRAG_FIELD_MIME) || draggingFieldId;
    if (!draggedFieldId || draggedFieldId === targetFieldId) {
      return;
    }

    const targetIndex = definition.fields.findIndex((field) => field.id === targetFieldId);
    if (targetIndex < 0) {
      return;
    }

    moveFieldToIndex(draggedFieldId, targetIndex);
    setDraggingFieldId(null);
  };

  const handleSectionDrop = (event: DragEvent<HTMLElement>, targetSectionId: string): void => {
    event.preventDefault();
    setDropTargetFieldId(null);
    setDropTargetSectionId(null);
    const draggedFieldId = event.dataTransfer.getData(DRAG_FIELD_MIME) || draggingFieldId;
    if (!draggedFieldId) {
      return;
    }
    moveFieldToSectionEnd(draggedFieldId, targetSectionId);
    setDraggingFieldId(null);
    setSelectedSectionId(targetSectionId);
  };

  const clearDragGhost = (): void => {
    if (dragGhost.current?.parentNode) {
      dragGhost.current.parentNode.removeChild(dragGhost.current);
    }
    dragGhost.current = null;
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
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}>
        <Box>
          <Typography variant="h5" component="h2">Form designer</Typography>
          <Typography variant="body2" color="text.secondary">Build the form structure, save draft changes, then publish a new version for future responses.</Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography role="status" aria-live="polite" variant="body2" color={saveState === "error" ? "error" : "text.secondary"}>
            {saveStateLabel(saveState)}{saveMessage ? ` - ${saveMessage}` : ""}
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
            Publish version
          </Button>
        </Stack>
      </Stack>
      <Box component="details" sx={{ mt: 2 }}>
        <Box component="summary">Advanced form settings</Box>
        <Stack spacing={2} sx={{ p: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Analytics identifiers and event delivery</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
              Optional tracking metadata for host analytics routing. This never changes form values or permissions.
            </Typography>
            <TrackingEditor form value={definition.tracking} onChange={tracking => updateDefinition(prev => ({ ...prev, tracking }))} />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Accessibility overrides</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
              Most accessibility behavior is automatic. Use overrides only when the default wording is unclear for assistive technology.
            </Typography>
            <AccessibilityEditor value={definition.accessibility} onChange={accessibility => updateDefinition(prev => ({ ...prev, accessibility }))} />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Connected host data</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
              Fields can use data provided by your host application. Authors choose how fields use it, but hosts control the actual integrations.
            </Typography>
            {unresolvedDependencies.length ? (
              <Stack spacing={1}>
                {unresolvedDependencies.map((entry) => (
                  <Paper key={entry.sourceId} variant="outlined" sx={{ p: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {entry.sourceId}: form expects {entry.expectedVersion}, host has {entry.availableVersion ?? "not available"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                      Affected fields: {entry.affectedFields.length ? entry.affectedFields.map((field) => field.label).join(", ") : "none"}
                    </Typography>
                    {entry.affectedFields[0] ? (
                      <Button
                        type="button"
                        size="small"
                        onClick={() => {
                          setSelectedFieldId(entry.affectedFields[0].id);
                          setActiveTab("data");
                        }}
                      >
                        Review affected field
                      </Button>
                    ) : null}
                  </Paper>
                ))}
                <Typography variant="caption" color="text.secondary">
                  You cannot publish until these host-data mismatches are resolved.
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">All required host data connections are available for this draft.</Typography>
            )}
          </Box>
        </Stack>
      </Box>
      <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "220px minmax(0, 2fr) minmax(280px, 1fr)" }, gap: 1.5 }}>
        <Paper component="aside" variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6">Add fields</Typography>
            <Button type="button" size="small" variant="text" onClick={addSection}>New section</Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, mb: 1 }}>
            New fields are added to the selected section.
          </Typography>
          <Stack spacing={0.75} sx={{ mb: 1.25 }}>
            {orderedSections.map((section, index) => (
              <Button
                key={section.id}
                type="button"
                size="small"
                variant={selectedSectionId === section.id ? "contained" : "outlined"}
                sx={{ justifyContent: "space-between" }}
                onClick={() => {
                  setSelectedSectionId(section.id);
                  if (selectedField?.sectionId !== section.id) {
                    setSelectedFieldId((sectionFields.get(section.id) ?? [])[0]?.id ?? null);
                  }
                }}
                onKeyDown={(event) => {
                  if (!event.altKey) {
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveSection(section.id, -1);
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveSection(section.id, 1);
                  }
                }}
              >
                <span>{section.title}</span>
                <span>{index + 1}</span>
              </Button>
            ))}
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
          <Typography variant="h6">Form preview layout</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Drag fields to reorder. Alt+ArrowUp/Down reorders fields. Alt+ArrowLeft/Right changes field width.
          </Typography>
          {pendingSectionRemovalId ? (
            <Alert severity="warning" sx={{ mb: 1 }}>
              <Stack spacing={1}>
                <Typography variant="body2">This section has fields. Move them to another section or delete them with the section.</Typography>
                {sectionMoveTargetId ? (
                  <FormControl size="small">
                    <InputLabel id="section-move-target-label">Move fields to</InputLabel>
                    <Select
                      labelId="section-move-target-label"
                      label="Move fields to"
                      value={sectionMoveTargetId}
                      onChange={(event) => setSectionMoveTargetId(String(event.target.value))}
                    >
                      {orderedSections.filter((section) => section.id !== pendingSectionRemovalId).map((section) => (
                        <MenuItem key={section.id} value={section.id}>{section.title}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null}
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {sectionMoveTargetId ? (
                    <Button
                      type="button"
                      size="small"
                      variant="contained"
                      onClick={() => finalizeSectionRemoval(pendingSectionRemovalId, "move", sectionMoveTargetId)}
                    >
                      Move fields and remove section
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={() => finalizeSectionRemoval(pendingSectionRemovalId, "delete")}
                  >
                    Delete section and fields
                  </Button>
                  <Button
                    type="button"
                    size="small"
                    onClick={() => {
                      setPendingSectionRemovalId(null);
                      setSectionMoveTargetId(null);
                    }}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            </Alert>
          ) : null}
          {definition.fields.length === 0 ? (
            <Alert severity="info" sx={{ mb: 1 }}>
              Start by adding a field from the Add fields panel.
            </Alert>
          ) : null}
          <Stack spacing={1.25}>
            {orderedSections.map((section, sectionIndex) => {
              const fields = sectionFields.get(section.id) ?? [];
              const selected = selectedSectionId === section.id;
              return (
                <Paper
                  key={section.id}
                  variant="outlined"
                  sx={{
                    p: 1,
                    borderColor: selected ? "primary.main" : dropTargetSectionId === section.id ? "secondary.main" : "divider",
                    borderStyle: dropTargetSectionId === section.id ? "dashed" : "solid"
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (draggingFieldId) {
                      setDropTargetSectionId(section.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dropTargetSectionId === section.id) {
                      setDropTargetSectionId(null);
                    }
                  }}
                  onDrop={(event) => handleSectionDrop(event, section.id)}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
                    {selected ? (
                      <TextField
                        size="small"
                        label="Section name"
                        value={section.title}
                        onChange={(event) => updateSectionTitle(section.id, event.target.value)}
                        sx={{ flex: 1 }}
                      />
                    ) : (
                      <Button
                        type="button"
                        variant="text"
                        sx={{ justifyContent: "flex-start", flex: 1 }}
                        onClick={() => {
                          setSelectedSectionId(section.id);
                          if (selectedField?.sectionId !== section.id) {
                            setSelectedFieldId(fields[0]?.id ?? null);
                          }
                        }}
                      >
                        {section.title}
                      </Button>
                    )}
                    <Tooltip title="Move section earlier">
                      <span>
                        <IconButton
                          aria-label="Move section earlier"
                          size="small"
                          disabled={sectionIndex === 0}
                          onClick={() => moveSection(section.id, -1)}
                        >
                          ↑
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move section later">
                      <span>
                        <IconButton
                          aria-label="Move section later"
                          size="small"
                          disabled={sectionIndex === orderedSections.length - 1}
                          onClick={() => moveSection(section.id, 1)}
                        >
                          ↓
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Remove section">
                      <span>
                        <IconButton aria-label="Remove section" size="small" color="error" onClick={() => requestSectionRemoval(section.id)}>✕</IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 1 }}>
                    {fields.map((field) => (
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
                          overflow: "hidden",
                          borderTop: dropTargetFieldId === field.id && draggingFieldId !== field.id ? "3px solid" : undefined,
                          borderTopColor: "secondary.main"
                        }}
                        onDragStart={(event) => {
                          setDraggingFieldId(field.id);
                          setDropTargetFieldId(null);
                          setDropTargetSectionId(null);
                          clearDragGhost();
                          const ghost = document.createElement("div");
                          ghost.textContent = field.label;
                          ghost.style.position = "fixed";
                          ghost.style.top = "0";
                          ghost.style.left = "0";
                          ghost.style.transform = "translate(-10000px, -10000px)";
                          ghost.style.padding = "8px 12px";
                          ghost.style.borderRadius = "8px";
                          ghost.style.background = "#0b57d0";
                          ghost.style.color = "#fff";
                          ghost.style.font = "600 13px sans-serif";
                          ghost.style.lineHeight = "1.2";
                          ghost.style.whiteSpace = "nowrap";
                          ghost.style.pointerEvents = "none";
                          document.body.appendChild(ghost);
                          dragGhost.current = ghost;
                          event.dataTransfer.setData(DRAG_FIELD_MIME, field.id);
                          event.dataTransfer.setData("text/plain", field.id);
                          event.dataTransfer.setDragImage(ghost, 14, 14);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggingFieldId(null);
                          setDropTargetFieldId(null);
                          setDropTargetSectionId(null);
                          clearDragGhost();
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (draggingFieldId && draggingFieldId !== field.id) {
                            setDropTargetFieldId(field.id);
                            setDropTargetSectionId(section.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dropTargetFieldId === field.id) {
                            setDropTargetFieldId(null);
                          }
                        }}
                        onDrop={(event) => handleCanvasDrop(event, field.id)}
                        onClick={() => {
                          setSelectedFieldId(field.id);
                          setSelectedSectionId(section.id);
                        }}
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
                  {!fields.length ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                      No fields in this section yet.
                    </Typography>
                  ) : null}
                </Paper>
              );
            })}
          </Stack>
        </Paper>

        <Paper component="aside" variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h6">Field settings</Typography>
            {selectedField ? (
              <Tooltip title="Remove field">
                <IconButton aria-label="Remove field" size="small" color="error" onClick={() => removeField(selectedField.id)}>
                  ✕
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>

          {!selectedField ? (
            <Typography variant="body2" color="text.secondary">Select a field in the preview to edit its settings.</Typography>
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
                    {tabLabel(tab)}
                  </Button>
                ))}
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {tabHelpText(activeTab)}
              </Typography>

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
                    <TextField select label="What this host data provides" value={selectedField.source.kind ?? "value"} slotProps={{ select: { native: true } }} onChange={e => updateSelectedField(field => ({ ...field, source: { ...field.source!, kind: e.target.value as "value" | "options" } }))}><option value="value">Field value</option><option value="options">Choice list</option></TextField>
                    <TextField label="Refresh when these field IDs change" value={selectedField.source.dependsOn?.join(",") ?? ""} helperText="Example: field_region, field_location. Use this when available choices depend on another answer." onChange={e => updateSelectedField(field => ({ ...field, source: { ...field.source!, dependsOn: e.target.value.split(",").map(id => id.trim()).filter(Boolean) } }))} />
                  </>}
                  <TextField
                    label="Starting value"
                    value={toEditableDefaultValue(selectedField.defaultValue)}
                    helperText="Optional value shown before someone enters a response."
                    onChange={(event) => updateSelectedField((field) => ({ ...field, defaultValue: event.target.value || undefined }))}
                  />
                  <FormControl size="small">
                    <InputLabel id="field-source-label">Prefill from host data</InputLabel>
                    <Select
                      labelId="field-source-label"
                      label="Prefill from host data"
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
                      <InputLabel id="field-source-mode-label">When host data should update this field</InputLabel>
                      <Select
                        labelId="field-source-mode-label"
                        label="When host data should update this field"
                        value={selectedField.source.mode}
                        onChange={(event) => {
                          const mode = event.target.value as NonNullable<Field["source"]>["mode"];
                          updateSelectedField((field) => ({
                            ...field,
                            source: field.source ? { ...field.source, mode } : field.source
                          }));
                        }}
                      >
                        <MenuItem value="manual">Never auto-update (manual entry only)</MenuItem>
                        <MenuItem value="create_only">Set once when a response is first created</MenuItem>
                        <MenuItem value="refresh_on_edit">Update each time the response is edited</MenuItem>
                        <MenuItem value="display_only">Always show host data (read-only)</MenuItem>
                      </Select>
                    </FormControl>
                  ) : null}

                  {selectedField.type === "single_select" || selectedField.type === "radio" || selectedField.type === "multi_select" ? (
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
      return "Choose from dropdown";
    case "radio":
      return "Choose one option";
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

function tabLabel(tab: BuilderTab): string {
  switch (tab) {
    case "basic":
      return "Field details";
    case "data":
      return "Data source";
    case "rules":
      return "Validation & conditions";
    case "layout":
      return "Placement";
    case "settings":
      return "Advanced";
    default:
      return tab;
  }
}

function tabHelpText(tab: BuilderTab): string {
  switch (tab) {
    case "basic":
      return "Label, guidance text, placeholder text, required setting, and upload limits.";
    case "data":
      return "Choose whether this field is entered manually or prefilled from host data.";
    case "rules":
      return "Set validation and conditional behavior for this field.";
    case "layout":
      return "Control section placement, width, and ordering.";
    case "settings":
      return "Optional analytics metadata and accessibility overrides.";
    default:
      return "";
  }
}

function saveStateLabel(state: SaveState): string {
  switch (state) {
    case "saved":
      return "All changes saved";
    case "saving":
      return "Saving draft";
    case "publishing":
      return "Publishing version";
    case "unsaved":
      return "Unsaved edits";
    case "error":
      return "Save failed";
    default:
      return state;
  }
}

function previewByType(field: Field): string {
  if (field.source) {
    return `Prefilled from ${field.source.id}`;
  }

  if (field.type === "single_select" || field.type === "radio" || field.type === "multi_select") {
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
