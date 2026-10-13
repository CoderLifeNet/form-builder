import { useEffect, useMemo, useState, useRef, type ReactElement } from "react";
import { FormBuilder, FormManager, ManagedForm, exportDefinition, importDefinition } from "@coderlifenet/form-builder";
import { createFormApiClient, createMutationRetryKey, createHttpUploadHandler, FormRenderer, RecordHistoryView } from "@coderlifenet/form-react";
import type { FormDefinition } from "@coderlifenet/form-core";
import { Box, Button, CssBaseline, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, ThemeProvider, Typography, createTheme } from "@coderlifenet/ui-core";

type View = "manager" | "builder" | "capture" | "history" | "settings" | "submissions" | "readOnly";

type ApiForm = {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  draftRevision: number | null;
  publishedVersion: number | null;
  publishedDefinitionId: string | null;
};

type ApiDraft = {
  revision: number;
  definition: FormDefinition;
};

type ApiDefinition = {
  id: string;
  formId: string;
  publicationVersion: number;
  definition: FormDefinition;
};

type ApiRecordRevision = {
  id: string;
  revisionNumber: number;
  definitionId: string;
  values: Record<string, unknown>;
  selectedLabels?: Record<string, string>;
  createdAt: string;
};

type ApiRecordListItem = {
  recordId: string;
  formId: string;
  formName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  currentRevisionId: string | null;
  currentRevisionNumber: number | null;
  currentDefinitionId: string | null;
};

type ApiRecordListResponse = {
  items: ApiRecordListItem[];
  nextCursor: number | null;
};

type ApiPublishedVersion = {
  id: string;
  formId: string;
  publicationVersion: number;
  publishedAt: string;
  fieldCount: number;
  name: string;
};

type BindingScopeType = "workspace" | "project";

type ApiBinding = {
  source: { type: BindingScopeType; id: string };
  revision: number;
  mode: "latest" | "pinned";
  definitionId: string;
  formId: string;
} | null;

const apiBase = import.meta.env.VITE_FORM_API_BASE_URL ?? "http://localhost:4010";

const starterDefinition: FormDefinition = {
  metadata: {
    formId: "workspace-demo",
    name: "Workspace service request",
    description: "Parent default form",
    schemaVersion: "1.0.0"
  },
  sections: [
    { id: "s1", title: "Details", order: 0 },
    { id: "s2", title: "Request", order: 1 }
  ],
  fields: [
    {
      id: "field_first_name",
      key: "field_first_name",
      type: "text",
      label: "First name",
      sectionId: "s1",
      row: 0,
      width: 6,
      required: true,
      rules: [],
      source: { id: "profile.first_name", version: "1", mode: "display_only" }
    },
    {
      id: "field_last_name",
      key: "field_last_name",
      type: "text",
      label: "Last name",
      sectionId: "s1",
      row: 0,
      width: 6,
      required: true,
      rules: [],
      source: { id: "profile.last_name", version: "1", mode: "display_only" }
    },
    {
      id: "field_title",
      key: "field_title",
      type: "text",
      label: "Request title",
      sectionId: "s2",
      row: 0,
      width: 12,
      required: true,
      validation: { minLength: 4 },
      rules: []
    },
    {
      id: "field_category",
      key: "field_category",
      type: "single_select",
      label: "Category",
      sectionId: "s2",
      row: 1,
      width: 6,
      required: true,
      options: [],
      source: { id: "request.categories", version: "1", mode: "refresh_on_edit", kind: "options" },
      rules: []
    },
    {
      id: "field_attachment",
      key: "field_attachment",
      type: "single_file",
      label: "Attachment",
      sectionId: "s2",
      row: 1,
      width: 6,
      required: false,
      uploadPolicy: { maxFiles: 1, maxBytes: 10 * 1024 * 1024, mediaTypes: ["application/pdf", "image/png", "image/jpeg"] },
      rules: []
    }
  ],
  dependencyVersions: {
    "profile.first_name": "1",
    "profile.last_name": "1",
    "request.categories": "1"
  }
};

const api = createFormApiClient({ baseUrl: apiBase });

export function App(): ReactElement {
  const submissionKey = useRef(createMutationRetryKey());
  const [sourceCapabilities, setSourceCapabilities] = useState<Record<string, string>>({});
  const [view, setView] = useState<View>("manager");
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<ApiDraft | null>(null);
  const draftRevision = useRef<number>(0);
  draftRevision.current = activeDraft?.revision ?? 0;
  const [activeDefinition, setActiveDefinition] = useState<ApiDefinition | null>(null);
  const [recordHistory, setRecordHistory] = useState<ApiRecordRevision[]>([]);
  const [historyDefinitions, setHistoryDefinitions] = useState<Record<string, FormDefinition>>({});
  const [captureRecordId, setCaptureRecordId] = useState<string | undefined>(undefined);
  const [captureExpectedRevision, setCaptureExpectedRevision] = useState<number | undefined>(undefined);
  const [captureInitialValues, setCaptureInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [submissions, setSubmissions] = useState<ApiRecordListItem[]>([]);
  const [submissionsCursor, setSubmissionsCursor] = useState<number | null>(null);
  const [submissionCreatorFilter, setSubmissionCreatorFilter] = useState("");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionDateFrom, setSubmissionDateFrom] = useState("");
  const [submissionDateTo, setSubmissionDateTo] = useState("");
  const [readOnlyDefinition, setReadOnlyDefinition] = useState<ApiDefinition | null>(null);
  const [readOnlyValues, setReadOnlyValues] = useState<Record<string, unknown>>({});
  const [publishedVersions, setPublishedVersions] = useState<ApiPublishedVersion[]>([]);
  const [selectedPublicationVersion, setSelectedPublicationVersion] = useState<number | "">("");
  const [bindingScopeType, setBindingScopeType] = useState<BindingScopeType>("workspace");
  const [bindingScopeId, setBindingScopeId] = useState("example-workspace");
  const [bindingMode, setBindingMode] = useState<"latest" | "pinned">("latest");
  const [bindingDefinitionId, setBindingDefinitionId] = useState("");
  const [binding, setBinding] = useState<ApiBinding>(null);
  const [sessionUserId, setSessionUserId] = useState("owner1");
  const [sessionTenantId, setSessionTenantId] = useState("tenant_alpha");
  const [status, setStatus] = useState<string>("Connecting...");

  const managerForms: ManagedForm[] = useMemo(
    () =>
      forms.map((form) => ({
        id: form.id,
        name: form.name,
        description: form.description ?? undefined,
        archived: form.archived,
        publishedVersion: form.publishedVersion ?? undefined,
        hasDraft: form.draftRevision !== null,
        definition: activeDraft?.definition ?? starterDefinition
      })),
    [forms, activeDraft]
  );

  async function login(userId: string, tenantId: string): Promise<void> {
    await api("/dev/login", {
      method: "POST",
      body: JSON.stringify({ userId, tenantId })
    });
    setSessionUserId(userId);
    setSessionTenantId(tenantId);
  }

  useEffect(() => {
    void (async () => {
      try {
        await login("owner1", "tenant_alpha");
        setStatus("Connected as owner1");
        await refreshForms();
        await refreshCapabilities();
        await refreshBinding();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to connect");
      }
    })();
  }, []);

  async function refreshCapabilities(): Promise<void> {
    try {
      setSourceCapabilities(await api<Record<string, string>>("/api/capabilities/sources"));
    } catch {
      setSourceCapabilities({});
    }
  }

  async function refreshBinding(): Promise<void> {
    const next = await api<ApiBinding>(`/api/bindings/${bindingScopeType}/${bindingScopeId}`);
    setBinding(next);
    if (next) {
      setBindingMode(next.mode);
      setBindingDefinitionId(next.definitionId);
    }
  }

  useEffect(() => {
    void refreshBinding().catch(() => {
      setBinding(null);
    });
  }, [bindingScopeType, bindingScopeId]);

  useEffect(() => {
    if (!activeId) {
      setPublishedVersions([]);
      setSelectedPublicationVersion("");
      return;
    }
    void loadPublishedVersions(activeId).catch(() => {
      setPublishedVersions([]);
      setSelectedPublicationVersion("");
    });
  }, [activeId]);

  async function refreshForms(): Promise<void> {
    const next = await api<ApiForm[]>("/api/forms?includeArchived=true");
    setForms(next);
    if (!activeId && next.length > 0) {
      setActiveId(next[0].id);
    }
  }

  async function loadPublishedVersions(formId: string): Promise<void> {
    const versions = await api<ApiPublishedVersion[]>(`/api/forms/${formId}/versions`);
    setPublishedVersions(versions);
    setSelectedPublicationVersion(versions[0]?.publicationVersion ?? "");
  }

  async function loadSubmissions(reset: boolean): Promise<void> {
    const params = new URLSearchParams();
    if (activeId) params.set("formId", activeId);
    params.set("pageSize", "20");
    params.set("cursor", String(reset ? 0 : (submissionsCursor ?? 0)));
    if (submissionCreatorFilter) params.set("createdBy", submissionCreatorFilter);
    if (submissionSearch) params.set("query", submissionSearch);
    if (submissionDateFrom) params.set("createdFrom", new Date(submissionDateFrom).toISOString());
    if (submissionDateTo) params.set("createdTo", new Date(submissionDateTo).toISOString());

    const listed = await api<ApiRecordListResponse>(`/api/records?${params.toString()}`);
    setSubmissions((previous) => (reset ? listed.items : [...previous, ...listed.items]));
    setSubmissionsCursor(listed.nextCursor);
  }

  function clearPrivateViewState(): void {
    setActiveDraft(null);
    setActiveDefinition(null);
    setCaptureRecordId(undefined);
    setCaptureExpectedRevision(undefined);
    setCaptureInitialValues(undefined);
    setRecordHistory([]);
    setHistoryDefinitions({});
    setSubmissions([]);
    setSubmissionsCursor(null);
    setReadOnlyDefinition(null);
    setReadOnlyValues({});
  }

  async function openBuilder(formId: string): Promise<void> {
    const draft = await api<ApiDraft>(`/api/forms/${formId}/draft`);
    setActiveId(formId);
    setActiveDraft(draft);
    setView("builder");
  }

  async function openCapture(formId: string, options?: { recordId?: string; initialValues?: Record<string, unknown>; definitionId?: string }): Promise<void> {
    const form = await api<ApiForm>(`/api/forms/${formId}`);
    if (!form.publishedDefinitionId) {
      setStatus("Publish the form before capture.");
      return;
    }

    const chosenDefinitionId = options?.definitionId ?? (binding && binding.formId === formId ? binding.definitionId : form.publishedDefinitionId);
    const definition = await api<ApiDefinition>(`/api/definitions/${chosenDefinitionId}`);
    setActiveId(formId);
    setActiveDefinition(definition);
    setCaptureRecordId(options?.recordId);
    setCaptureExpectedRevision(undefined);
    setCaptureInitialValues(options?.initialValues);
    setView("capture");
  }

  async function openCaptureFromScopeBinding(): Promise<void> {
    const resolved = await api<ApiBinding>(`/api/bindings/${bindingScopeType}/${bindingScopeId}`);
    if (!resolved) {
      setStatus("No scope default is configured yet.");
      return;
    }
    setBinding(resolved);
    await openCapture(resolved.formId, { definitionId: resolved.definitionId });
  }

  async function openEditRecord(recordId: string): Promise<void> {
    const revisions = await api<ApiRecordRevision[]>(`/api/records/${recordId}/history`);
    if (!revisions.length) {
      setStatus("No revisions were found for this record.");
      return;
    }
    const latest = revisions[0];
    const definition = await api<ApiDefinition>(`/api/definitions/${latest.definitionId}`);
    setActiveId(definition.formId);
    setCaptureRecordId(recordId);
    setCaptureExpectedRevision(latest.revisionNumber);
    setCaptureInitialValues(latest.values);
    setActiveDefinition(definition);
    setView("capture");
  }

  async function openRecordHistory(recordId: string): Promise<void> {
    const revisions = await api<ApiRecordRevision[]>(`/api/records/${recordId}/history`);
    if (!revisions.length) {
      setStatus("No revisions were found for this record.");
      return;
    }
    const uniqueDefinitionIds = [...new Set(revisions.map((item) => item.definitionId))];
    const definitions = await Promise.all(
      uniqueDefinitionIds.map(async (definitionId) => {
        const definition = await api<ApiDefinition>(`/api/definitions/${definitionId}`);
        return [definitionId, definition.definition] as const;
      })
    );
    const latestDefinition = await api<ApiDefinition>(`/api/definitions/${revisions[0].definitionId}`);
    setActiveDefinition(latestDefinition);
    setHistoryDefinitions(Object.fromEntries(definitions));
    setRecordHistory(revisions);
    setView("history");
  }

  async function openReadOnlyRecord(recordId: string): Promise<void> {
    const revisions = await api<ApiRecordRevision[]>(`/api/records/${recordId}/history`);
    if (!revisions.length) {
      setStatus("No revisions were found for this record.");
      return;
    }
    const latest = revisions[0];
    const definition = await api<ApiDefinition>(`/api/definitions/${latest.definitionId}`);
    setReadOnlyDefinition(definition);
    setReadOnlyValues(latest.values);
    setView("readOnly");
  }

  async function openPublishedVersionReadOnly(formId: string, publicationVersion: number): Promise<void> {
    const definition = await api<ApiDefinition>(`/api/forms/${formId}/versions/${publicationVersion}`);
    setReadOnlyDefinition(definition);
    setReadOnlyValues({});
    setView("readOnly");
  }

  async function createForm(): Promise<void> {
    const created = await api<{ formId: string }>("/api/forms", {
      method: "POST",
      body: JSON.stringify({
        name: `Form ${new Date().toISOString()}`,
        description: "Created from workspace example",
        definition: starterDefinition
      })
    });
    await refreshForms();
    await openBuilder(created.formId);
  }

  const customTheme = createTheme({
    palette: {
      mode: "light",
      primary: { main: "#0050b3" },
      secondary: { main: "#2e7d32" },
      background: { default: "#f6f9ff" }
    },
    typography: {
      fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif",
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 }
    },
    components: {
      MuiButton: {
        styleOverrides: { root: { borderRadius: 10, textTransform: "none" } }
      },
      MuiPaper: {
        styleOverrides: { root: { borderRadius: 14 } }
      }
    }
  });

  const content = (
    <Box component="main" sx={{ maxWidth: 1200, margin: "0 auto", p: 2.5 }}>
      <Typography variant="h4" component="h1">Workspace/project host example</Typography>
      <Typography variant="body1" sx={{ mt: 1 }}>
        Real API integration for manager, builder, publish, capture, history, archive, import and export.
      </Typography>
      <Typography aria-live="polite" variant="body2" color="text.secondary" sx={{ mt: 1 }}>{status}</Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, mb: 2 }}>
        <Button type="button" variant={view === "manager" ? "contained" : "outlined"} onClick={() => setView("manager")}>Manager</Button>
        <Button type="button" variant={view === "builder" ? "contained" : "outlined"} onClick={() => activeId && openBuilder(activeId)}>Builder</Button>
        <Button type="button" variant={view === "capture" ? "contained" : "outlined"} onClick={() => activeId && openCapture(activeId)}>Capture</Button>
        <Button type="button" variant={view === "submissions" ? "contained" : "outlined"} onClick={async () => {
          setView("submissions");
          await loadSubmissions(true);
        }}>Submissions</Button>
        <Button
          type="button"
          variant={view === "history" ? "contained" : "outlined"}
          onClick={async () => {
            if (!submissions.length) {
              await loadSubmissions(true);
            }
            const target = submissions[0];
            if (!target) {
              setStatus("Submit at least one record first.");
              return;
            }
            await openRecordHistory(target.recordId);
          }}
        >
          History
        </Button>
        <Button type="button" variant={view === "readOnly" ? "contained" : "outlined"} onClick={async () => {
          if (!submissions.length) {
            await loadSubmissions(true);
          }
          const target = submissions[0];
          if (!target) {
            setStatus("No submission is available yet.");
            return;
          }
          await openReadOnlyRecord(target.recordId);
        }}>Read only</Button>
        <Button type="button" variant={view === "settings" ? "contained" : "outlined"} onClick={() => setView("settings")}>Settings</Button>
        <Button type="button" variant={useCustomTheme ? "contained" : "outlined"} color="secondary" onClick={() => setUseCustomTheme((prev) => !prev)}>
          {useCustomTheme ? "Custom theme on" : "Stock MUI theme"}
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ alignItems: { md: "center" } }}>
          <Typography variant="body2" color="text.secondary">Session</Typography>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="session-user-label">User</InputLabel>
            <Select labelId="session-user-label" label="User" value={sessionUserId} onChange={async (event) => {
              const userId = String(event.target.value);
              const tenantId = userId === "outsider1" ? "tenant_beta" : "tenant_alpha";
              try {
                clearPrivateViewState();
                setView("manager");
                await login(userId, tenantId);
                await refreshForms();
                await refreshCapabilities();
                await refreshBinding();
                if (activeId) {
                  await loadPublishedVersions(activeId);
                }
                setStatus(`Connected as ${userId} (${tenantId})`);
              } catch (error) {
                setStatus(error instanceof Error ? error.message : "Unable to switch session");
              }
            }}>
              <MenuItem value="owner1">owner1 (admin)</MenuItem>
              <MenuItem value="collab1">collab1 (collaborator)</MenuItem>
              <MenuItem value="outsider1">outsider1 (outsider)</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">tenant: {sessionTenantId}</Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        {view === "manager" ? (
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <Button type="button" variant="outlined" onClick={() => void openCaptureFromScopeBinding()}>Capture from scope binding</Button>
              <Button type="button" variant="outlined" onClick={async () => {
                setView("submissions");
                await loadSubmissions(true);
              }}>Browse submissions</Button>
            </Stack>
            <FormManager
              forms={managerForms}
              onCreateForm={() => {
                void createForm();
              }}
              onOpenBuilder={(formId) => {
                void openBuilder(formId);
              }}
              onDuplicate={(formId) => {
                void (async () => {
                  await api(`/api/forms/${formId}/duplicate`, { method: "POST" });
                  await refreshForms();
                  setStatus("Form duplicated");
                })();
              }}
              onExport={(formId) => {
                void (async () => {
                  const exported = await api<{ definition: FormDefinition; dependencies: Record<string, string> }>(`/api/forms/${formId}/export`);
                  const blob = new Blob([exportDefinition(exported.definition)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `form-${formId}.json`;
                  link.click();
                  URL.revokeObjectURL(url);
                  setStatus("Form exported");
                })();
              }}
              onArchiveToggle={(formId) => {
                void (async () => {
                  const target = forms.find((form) => form.id === formId);
                  if (!target) {
                    return;
                  }
                  await api(`/api/forms/${formId}/${target.archived ? "restore" : "archive"}`, { method: "POST" });
                  await refreshForms();
                  setStatus(target.archived ? "Form restored" : "Form archived");
                })();
              }}
              onImportAsNew={() => {
                void (async () => {
                  const input = window.prompt("Paste exported form JSON");
                  if (!input) {
                    return;
                  }
                  const imported = importDefinition(input);
                  await api("/api/forms/import-as-new", {
                    method: "POST",
                    body: JSON.stringify({
                      name: `${imported.metadata.name} imported`,
                      description: imported.metadata.description,
                      envelope: { formatVersion: 1, definition: imported, dependencies: imported.dependencyVersions }
                    })
                  });
                  await refreshForms();
                  setStatus("Form imported");
                })();
              }}
            />
          </Stack>
        ) : null}

        {view === "settings" ? (
          <Stack spacing={2}>
            <Typography variant="h6">Workspace/project binding controls</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="scope-type-label">Scope type</InputLabel>
                <Select labelId="scope-type-label" label="Scope type" value={bindingScopeType} onChange={(event) => {
                  const nextType = event.target.value as BindingScopeType;
                  setBindingScopeType(nextType);
                  setBindingScopeId(nextType === "workspace" ? "example-workspace" : "example-project");
                  setBinding(null);
                }}>
                  <MenuItem value="workspace">workspace</MenuItem>
                  <MenuItem value="project">project</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="scope-id-label">Scope id</InputLabel>
                <Select labelId="scope-id-label" label="Scope id" value={bindingScopeId} onChange={(event) => setBindingScopeId(String(event.target.value))}>
                  <MenuItem value={bindingScopeType === "workspace" ? "example-workspace" : "example-project"}>{bindingScopeType === "workspace" ? "example-workspace" : "example-project"}</MenuItem>
                </Select>
              </FormControl>
              <Button type="button" variant="outlined" onClick={async () => {
                try {
                  await refreshBinding();
                  setStatus("Scope binding loaded");
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : "Binding read failed");
                }
              }}>Load binding</Button>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="binding-mode-label">Binding mode</InputLabel>
                <Select labelId="binding-mode-label" label="Binding mode" value={bindingMode} onChange={(event) => setBindingMode(event.target.value as "latest" | "pinned")}>
                  <MenuItem value="latest">latest</MenuItem>
                  <MenuItem value="pinned">pinned</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 280 }}>
                <InputLabel id="binding-definition-label">Pinned definition</InputLabel>
                <Select labelId="binding-definition-label" label="Pinned definition" value={bindingDefinitionId} onChange={(event) => setBindingDefinitionId(String(event.target.value))}>
                  {forms.filter(form => form.publishedDefinitionId).map(form => (
                    <MenuItem key={form.id} value={form.publishedDefinitionId ?? ""}>{form.name} ({form.publishedDefinitionId})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <Button type="button" variant="contained" onClick={async () => {
                try {
                  const selectedForm = forms.find(form => form.publishedDefinitionId === bindingDefinitionId) ?? forms.find(form => form.publishedDefinitionId);
                  if (!selectedForm) {
                    setStatus("Publish at least one form before saving a binding.");
                    return;
                  }
                  const payload = {
                    formId: selectedForm.id,
                    mode: bindingMode,
                    definitionId: bindingMode === "pinned" ? bindingDefinitionId : undefined,
                    expectedRevision: binding?.source.type === bindingScopeType && binding.source.id === bindingScopeId ? binding.revision : 0
                  };
                  await api(`/api/bindings/${bindingScopeType}/${bindingScopeId}`, { method: "PUT", body: JSON.stringify(payload) });
                  await refreshBinding();
                  setStatus(`Saved ${bindingScopeType} binding (${bindingMode}).`);
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : "Binding save failed");
                }
              }}>Save binding</Button>
              <Button type="button" variant="outlined" disabled={bindingScopeType !== "project" || !binding} onClick={async () => {
                if (!binding) return;
                try {
                  await api(`/api/bindings/${bindingScopeType}/${bindingScopeId}`, { method: "DELETE", body: JSON.stringify({ expectedRevision: binding.revision }) });
                  await refreshBinding();
                  setStatus("Project override reset to inherited defaults.");
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : "Binding reset failed");
                }
              }}>Reset to inheritance</Button>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              Active binding: {binding ? `${binding.source.type}/${binding.source.id} -> ${binding.mode} (${binding.definitionId}) rev ${binding.revision}` : "none"}
            </Typography>

            <Stack spacing={1}>
              <Typography variant="h6">Published versions</Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel id="published-version-label">Version</InputLabel>
                  <Select
                    labelId="published-version-label"
                    label="Version"
                    value={selectedPublicationVersion}
                    onChange={(event) => setSelectedPublicationVersion(Number(event.target.value))}
                  >
                    {publishedVersions.map((version) => (
                      <MenuItem key={version.id} value={version.publicationVersion}>
                        v{version.publicationVersion} · {new Date(version.publishedAt).toLocaleString()} · {version.fieldCount} fields
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={!activeId || selectedPublicationVersion === ""}
                  onClick={async () => {
                    if (!activeId || selectedPublicationVersion === "") return;
                    await openPublishedVersionReadOnly(activeId, Number(selectedPublicationVersion));
                  }}
                >
                  Open selected version read only
                </Button>
              </Stack>
            </Stack>
          </Stack>
        ) : null}

        {activeDraft && activeId ? (
          <Box hidden={view !== "builder"}>
          <FormBuilder
            initialDefinition={activeDraft.definition}
            sourceCapabilities={sourceCapabilities}
            onSaved={() => setView("manager")}
            onReloadDraft={async () => { const draft = await api<ApiDraft>(`/api/forms/${activeId}/draft`); draftRevision.current = draft.revision; setActiveDraft(draft); return draft.definition; }}
            onSaveDraft={async (nextDefinition) => {
              const saved = await api<{ revision: number }>(`/api/forms/${activeId}/draft`, {
                method: "PUT",
                body: JSON.stringify({ expectedRevision: draftRevision.current, definition: nextDefinition })
              });
              draftRevision.current = saved.revision;
              setActiveDraft({ revision: saved.revision, definition: nextDefinition });
              await refreshForms();
              setStatus(`Draft saved r${saved.revision}`);
            }}
            onPublish={async (nextDefinition) => {
              const saved = await api<{ revision: number }>(`/api/forms/${activeId}/draft`, {
                method: "PUT",
                body: JSON.stringify({ expectedRevision: draftRevision.current, definition: nextDefinition })
              });
              draftRevision.current = saved.revision;
              setActiveDraft({ revision: saved.revision, definition: nextDefinition });
              const published = await api<{ definitionId: string; publicationVersion: number }>(`/api/forms/${activeId}/publish`, {
                method: "POST",
                body: JSON.stringify({ expectedRevision: saved.revision })
              });
              draftRevision.current = saved.revision;
              setActiveDraft({ revision: saved.revision, definition: nextDefinition });
              await refreshForms();
              setStatus(`Published v${published.publicationVersion}`);
            }}
          />
          </Box>
        ) : null}

        {view === "capture" && activeDefinition && activeId ? (
          <FormRenderer
            key={`${sessionTenantId}:${activeId}:${activeDefinition.id}:${captureRecordId ?? "new"}`}
            renderIdentity={`${sessionTenantId}:${activeId}:${activeDefinition.id}:${captureRecordId ?? "new"}`}
            uploadFile={createHttpUploadHandler(apiBase, activeId, activeDefinition.id)}
            definition={activeDefinition.definition}
            initialValues={captureInitialValues}
            optionSourceResolver={async (sourceId, values, signal) => {
              const field = activeDefinition.definition.fields.find(field => field.source?.id === sourceId);
              if (!field) throw new Error("Source field not found");
              const response = await fetch(`${apiBase}/api/definitions/${activeDefinition.id}/sources/${field.id}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ values }), signal });
              if (!response.ok) throw new Error("Source request failed");
              return (await response.json()).value;
            }}
            sourceResolver={async (sourceId, values, signal) => {
              const field = activeDefinition.definition.fields.find(candidate => candidate.source?.id === sourceId && candidate.source.kind !== "options");
              if (!field) return undefined;
              const response = await fetch(`${apiBase}/api/definitions/${activeDefinition.id}/sources/${field.id}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ values }), signal });
              if (!response.ok) throw new Error("Source request failed");
              return (await response.json()).value;
            }}
            mode={captureRecordId ? "edit" : "new"}
            onSubmit={async (values) => {
              const editingRecordId = captureRecordId;
              const payload = JSON.stringify({
                  formId: activeId,
                  definitionId: activeDefinition.id,
                  recordId: editingRecordId,
                  expectedRevision: editingRecordId ? captureExpectedRevision : undefined,
                  binding: binding ? { scopeType: bindingScopeType, scopeId: bindingScopeId, revision: binding.revision, definitionId: binding.definitionId } : undefined,
                  values,
                  uploadIds: activeDefinition.definition.fields.filter(field => field.type === "single_file" || field.type === "multi_file").flatMap(field => Array.isArray(values[field.id]) ? values[field.id] as string[] : values[field.id] ? [String(values[field.id])] : [])
                });
              const result = await api<{ recordId: string }>("/api/records", {
                method: "POST",
                headers: {
                  "idempotency-key": submissionKey.current.keyFor(payload)
                },
                body: payload
              });
              submissionKey.current.committed();
              setCaptureRecordId(result.recordId);
              setCaptureExpectedRevision((previous) => (editingRecordId ? (previous ?? 0) + 1 : 1));
              setCaptureInitialValues(values);
              await loadSubmissions(true);
              setStatus(`Record saved: ${result.recordId}`);
            }}
          />
        ) : null}

        {view === "submissions" ? (
          <Stack spacing={1.5}>
            <Typography variant="h6">Submissions</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField size="small" label="Created by" value={submissionCreatorFilter} onChange={(event) => setSubmissionCreatorFilter(event.target.value)} />
              <TextField size="small" label="Record or form search" value={submissionSearch} onChange={(event) => setSubmissionSearch(event.target.value)} />
              <TextField size="small" type="date" label="From" value={submissionDateFrom} onChange={(event) => setSubmissionDateFrom(event.target.value)} />
              <TextField size="small" type="date" label="To" value={submissionDateTo} onChange={(event) => setSubmissionDateTo(event.target.value)} />
              <Button type="button" variant="contained" onClick={() => void loadSubmissions(true)}>Apply filters</Button>
            </Stack>
            {submissions.map((submission) => (
              <Paper key={submission.recordId} variant="outlined" sx={{ p: 1.5 }} data-testid={`submission-${submission.recordId}`}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="subtitle1">{submission.recordId}</Typography>
                    <Typography variant="body2" color="text.secondary">{submission.formName} · created by {submission.createdBy}</Typography>
                    <Typography variant="body2" color="text.secondary">Created {new Date(submission.createdAt).toLocaleString()} · Updated {new Date(submission.updatedAt).toLocaleString()}</Typography>
                    <Typography variant="body2" color="text.secondary">Revision {submission.currentRevisionNumber ?? "-"}</Typography>
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button type="button" variant="outlined" onClick={() => void openReadOnlyRecord(submission.recordId)}>Read only</Button>
                    <Button type="button" variant="outlined" onClick={() => void openEditRecord(submission.recordId)}>Edit</Button>
                    <Button type="button" variant="outlined" onClick={() => void openRecordHistory(submission.recordId)}>History</Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
            {!submissions.length ? <Typography variant="body2" color="text.secondary">No submissions found for the current filters.</Typography> : null}
            <Button type="button" variant="outlined" disabled={submissionsCursor === null} onClick={() => void loadSubmissions(false)}>Load more</Button>
          </Stack>
        ) : null}

        {view === "readOnly" && readOnlyDefinition ? (
          <Stack spacing={1.5}>
            <Typography variant="h6">Read-only rendering</Typography>
            <FormRenderer
              key={`readonly:${readOnlyDefinition.id}`}
              renderIdentity={`readonly:${sessionTenantId}:${readOnlyDefinition.id}`}
              definition={readOnlyDefinition.definition}
              initialValues={readOnlyValues}
              mode="read_only"
            />
          </Stack>
        ) : null}

        {view === "history" && recordHistory.length > 0 && activeDefinition ? (
          <Stack spacing={1.5}>
            <Button type="button" variant="outlined" onClick={async () => {
              if (!submissions.length) {
                await loadSubmissions(true);
              }
              const target = submissions[0];
              if (!target) {
                setStatus("No submission is available to edit.");
                return;
              }
              await openEditRecord(target.recordId);
            }}>Edit latest record</Button>
            <RecordHistoryView
              definition={activeDefinition.definition}
              revisions={recordHistory.map((item) => ({
                id: item.id,
                revisionNumber: item.revisionNumber,
                savedAt: item.createdAt,
                values: item.values,
                selectedLabels: item.selectedLabels,
                definition: historyDefinitions[item.definitionId]
              }))}
            />
          </Stack>
        ) : null}
      </Paper>
    </Box>
  );

  if (useCustomTheme) {
    return (
      <ThemeProvider theme={customTheme}>
        <CssBaseline />
        {content}
      </ThemeProvider>
    );
  }

  return content;
}
