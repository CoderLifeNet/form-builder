import { useEffect, useMemo, useState, useRef, type ReactElement } from "react";
import { FormBuilder, FormManager, ManagedForm, exportDefinition, importDefinition } from "@coderlifenet/form-builder";
import { createFormApiClient, createMutationRetryKey, createHttpUploadHandler, FormRenderer, RecordHistoryView } from "@coderlifenet/form-react";
import type { FormDefinition } from "@coderlifenet/form-core";
import { Box, Button, CssBaseline, Paper, Stack, ThemeProvider, Typography, createTheme } from "@coderlifenet/ui-core";
import { createAnalyticsRuntime, createMemoryAdapter } from "@coderlifenet/ui-core/analytics";
import { UIExtensionsProvider, createAnalyticsExtension } from "@coderlifenet/ui-core/extensions";

type View = "manager" | "builder" | "capture" | "history";

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
    }
  ],
  dependencyVersions: {
    "profile.first_name": "1",
    "profile.last_name": "1"
  }
};

const api = createFormApiClient({ baseUrl: apiBase });

export function App(): ReactElement {
  const submissionKey = useRef(createMutationRetryKey());
  const memoryAdapter = useMemo(() => createMemoryAdapter(), []);
  const analyticsRuntime = useMemo(() => createAnalyticsRuntime([memoryAdapter], {
    enabled: true,
    consent: {
      analyticsStorage: "granted",
      adStorage: "denied"
    }
  }), [memoryAdapter]);
  const extensions = useMemo(() => [createAnalyticsExtension(analyticsRuntime)], [analyticsRuntime]);
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
  const [lastRecordId, setLastRecordId] = useState<string>("");
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

  useEffect(() => {
    void (async () => {
      try {
        await api("/dev/login", {
          method: "POST",
          body: JSON.stringify({ userId: "owner1", tenantId: "tenant_alpha" })
        });
        setStatus("Connected as owner1");
        await refreshForms();
        setSourceCapabilities(await api<Record<string,string>>("/api/capabilities/sources"));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to connect");
      }
    })();
  }, []);

  async function refreshForms(): Promise<void> {
    const next = await api<ApiForm[]>("/api/forms?includeArchived=true");
    setForms(next);
    if (!activeId && next.length > 0) {
      setActiveId(next[0].id);
    }
  }

  async function openBuilder(formId: string): Promise<void> {
    const draft = await api<ApiDraft>(`/api/forms/${formId}/draft`);
    setActiveId(formId);
    setActiveDraft(draft);
    setView("builder");
  }

  async function openCapture(formId: string): Promise<void> {
    const form = await api<ApiForm>(`/api/forms/${formId}`);
    if (!form.publishedDefinitionId) {
      setStatus("Publish the form before capture.");
      return;
    }
    const definition = await api<ApiDefinition>(`/api/definitions/${form.publishedDefinitionId}`);
    setActiveId(formId);
    setActiveDefinition(definition);
    setView("capture");
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
        <Button
          type="button"
          variant={view === "history" ? "contained" : "outlined"}
          onClick={async () => {
            if (!lastRecordId) {
              setStatus("Submit a record first.");
              return;
            }
            const revisions = await api<ApiRecordRevision[]>(`/api/records/${lastRecordId}/history`);
            const uniqueDefinitionIds = [...new Set(revisions.map((item) => item.definitionId))];
            const definitions = await Promise.all(
              uniqueDefinitionIds.map(async (definitionId) => {
                const definition = await api<ApiDefinition>(`/api/definitions/${definitionId}`);
                return [definitionId, definition.definition] as const;
              })
            );
            setHistoryDefinitions(Object.fromEntries(definitions));
            setRecordHistory(revisions);
            setView("history");
          }}
        >
          History
        </Button>
        <Button type="button" variant={useCustomTheme ? "contained" : "outlined"} color="secondary" onClick={() => setUseCustomTheme((prev) => !prev)}>
          {useCustomTheme ? "Custom theme on" : "Stock MUI theme"}
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        {view === "manager" ? (
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
            key={activeDefinition.id}
            uploadFile={createHttpUploadHandler(apiBase, activeId, activeDefinition.id)}
            definition={activeDefinition.definition}
            optionSourceResolver={async (sourceId, values, signal) => {
              const field = activeDefinition.definition.fields.find(field => field.source?.id === sourceId);
              if (!field) throw new Error("Source field not found");
              const response = await fetch(`${apiBase}/api/definitions/${activeDefinition.id}/sources/${field.id}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ values }), signal });
              if (!response.ok) throw new Error("Source request failed");
              return (await response.json()).value;
            }}
            mode="new"
            onSubmit={async (values) => {
              const payload = JSON.stringify({
                  formId: activeId,
                  definitionId: activeDefinition.id,
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
              setLastRecordId(result.recordId);
              setStatus(`Record saved: ${result.recordId}`);
            }}
            sourceResolver={async (sourceId) => {
              if (sourceId === "profile.first_name") {
                return "Owner";
              }
              if (sourceId === "profile.last_name") {
                return "User";
              }
              return undefined;
            }}
          />
        ) : null}

        {view === "history" && recordHistory.length > 0 && activeDefinition ? (
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
        ) : null}
      </Paper>
    </Box>
  );

  if (useCustomTheme) {
    return (
      <UIExtensionsProvider initialConfig={{ enabled: true, debug: false }} extensions={extensions}>
        <ThemeProvider theme={customTheme}>
          <CssBaseline />
          {content}
        </ThemeProvider>
      </UIExtensionsProvider>
    );
  }

  return <UIExtensionsProvider initialConfig={{ enabled: true, debug: false }} extensions={extensions}>{content}</UIExtensionsProvider>;
}
