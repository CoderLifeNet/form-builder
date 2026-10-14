import { useEffect, useState, useRef, type ReactElement } from "react";
import { FormBuilder } from "@coderlifenet/form-builder/builder";
import { createFormApiClient, createMutationRetryKey, createHttpUploadHandler, FormRenderer } from "@coderlifenet/form-builder/renderer";
import type { FormDefinition } from "@coderlifenet/form-builder/core";
import { Box, Button, CssBaseline, Paper, Stack, ThemeProvider, Typography, createTheme } from "@coderlifenet/ui-core";

const apiBase = import.meta.env.VITE_FORM_API_BASE_URL ?? "http://localhost:4010";

const starterDefinition: FormDefinition = {
  metadata: { formId: "demo-min", name: "Minimal service request", schemaVersion: "1.0.0" },
  tracking: { id: "minimal-form", events: ["ui.text_field.change"], metadata: { surface: "capture" } },
  sections: [
    { id: "sec_a", title: "Your details", order: 0 },
    { id: "sec_b", title: "Request", order: 1 }
  ],
  fields: [
    {
      id: "field_first_name",
      key: "field_first_name",
      type: "text",
      label: "First name",
      required: true,
      sectionId: "sec_a",
      row: 0,
      width: 6,
      source: { id: "profile.first_name", version: "1", mode: "display_only" },
      rules: []
    },
    {
      id: "field_last_name",
      key: "field_last_name",
      type: "text",
      label: "Last name",
      required: true,
      sectionId: "sec_a",
      row: 0,
      width: 6,
      source: { id: "profile.last_name", version: "1", mode: "display_only" },
      rules: []
    },
    {
      id: "field_title",
      key: "field_title",
      type: "text",
      label: "Request title",
      required: true,
      sectionId: "sec_b",
      row: 0,
      width: 12,
      tracking: { id: "request-title", semanticId: "request-title-control", events: ["ui.text_field.change"] },
      validation: { minLength: 4 },
      rules: []
    },
    {
      id: "field_category",
      key: "field_category",
      type: "single_select",
      label: "Category",
      required: true,
      sectionId: "sec_b",
      row: 1,
      width: 6,
      options: [
        { id: "equipment", label: "Equipment" },
        { id: "access", label: "Access" },
        { id: "other", label: "Other" }
      ],
      rules: []
    },
    {
      id: "field_priority",
      key: "field_priority",
      type: "radio",
      label: "Priority",
      required: true,
      sectionId: "sec_b",
      row: 1,
      width: 6,
      defaultValue: "normal",
      options: [
        { id: "low", label: "Low" },
        { id: "normal", label: "Normal" },
        { id: "high", label: "High" }
      ],
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
  const [definition, setDefinition] = useState(starterDefinition);
  const [publishedDefinition, setPublishedDefinition] = useState<FormDefinition | null>(null);
  const [mode, setMode] = useState<"builder" | "renderer">("builder");
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [formId, setFormId] = useState<string>("");
  const [draftRevision, setDraftRevision] = useState<number>(1);
  const revisionRef = useRef(1);
  revisionRef.current = draftRevision;
  const [definitionId, setDefinitionId] = useState<string>("");
  const [status, setStatus] = useState<string>("Connecting...");

  useEffect(() => {
    void (async () => {
      try {
        await api("/dev/login", {
          method: "POST",
          body: JSON.stringify({ userId: "owner1", tenantId: "tenant_alpha" })
        });
        const created = await api<{ formId: string; draftRevision: number }>("/api/forms", {
          method: "POST",
          body: JSON.stringify({
            name: `Minimal ${new Date().toISOString()}`,
            description: "Minimal example form",
            definition
          })
        });
        setFormId(created.formId);
        setDraftRevision(created.draftRevision);
        setStatus(`Created ${created.formId}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to connect");
      }
    })();
  }, []);

  const customTheme = createTheme({
    palette: {
      mode: "light",
      primary: { main: "#0b57d0" },
      secondary: { main: "#00695f" },
      background: { default: "#f7f9fc", paper: "#ffffff" }
    },
    typography: {
      fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif",
      h4: { fontWeight: 700 }
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 10, textTransform: "none" } }
      },
      MuiPaper: {
        styleOverrides: { root: { borderRadius: 14 } }
      }
    }
  });

  const content = (
    <Box component="main" sx={{ maxWidth: 1100, margin: "0 auto", p: 2.5 }}>
      <Typography variant="h4" component="h1">Minimal form host example</Typography>
      <Typography variant="body1" sx={{ mt: 1 }}>Design a form, publish a version, then fill it out with the same reusable package.</Typography>
      <Typography aria-live="polite" variant="body2" color="text.secondary" sx={{ mt: 1 }}>{status}</Typography>
      <Paper variant="outlined" sx={{ p: 1.25, mt: 1.5, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
          <Box>
            <Typography variant="subtitle2">Demo tools: host controls</Typography>
            <Typography variant="caption" color="text.secondary">Theme and navigation controls used only by this demo shell.</Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button type="button" variant={mode === "builder" ? "contained" : "outlined"} onClick={() => setMode("builder")}>Design form</Button>
            <Button type="button" variant={mode === "renderer" ? "contained" : "outlined"} onClick={() => setMode("renderer")}>Fill out form</Button>
            <Button type="button" variant={useCustomTheme ? "contained" : "outlined"} color="secondary" onClick={() => setUseCustomTheme((prev) => !prev)}>
              {useCustomTheme ? "Use custom theme" : "Use default theme"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box hidden={mode !== "builder"}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Form design and publishing</Typography>
          <FormBuilder
            initialDefinition={definition}
            onReloadDraft={async () => { const draft = await api<{revision:number;definition:FormDefinition}>(`/api/forms/${formId}/draft`); revisionRef.current = draft.revision; setDraftRevision(draft.revision); setDefinition(draft.definition); return draft.definition; }}
            sourceCapabilities={{ "profile.first_name": "1", "profile.last_name": "1", "request.categories": "1", "request.title_hint": "1" }}
            onSaveDraft={async (nextDefinition) => {
              if (!formId) {
                throw new Error("Form is not connected yet");
              }
              const saved = await api<{ revision: number }>(`/api/forms/${formId}/draft`, {
                method: "PUT",
                body: JSON.stringify({ expectedRevision: revisionRef.current, definition: nextDefinition })
              });
              revisionRef.current = saved.revision;
              setDraftRevision(saved.revision);
              setDefinition(nextDefinition);
              setStatus(`Draft saved r${saved.revision}`);
            }}
            onPublish={async (nextDefinition) => {
              if (!formId) {
                throw new Error("Form is not connected yet");
              }
              const saved = await api<{ revision: number }>(`/api/forms/${formId}/draft`, {
                method: "PUT",
                body: JSON.stringify({ expectedRevision: revisionRef.current, definition: nextDefinition })
              });
              revisionRef.current = saved.revision;
              setDraftRevision(saved.revision);
              const published = await api<{ definitionId: string; publicationVersion: number }>(`/api/forms/${formId}/publish`, {
                method: "POST",
                body: JSON.stringify({ expectedRevision: saved.revision })
              });
              revisionRef.current = saved.revision;
              setDraftRevision(saved.revision);
              setDefinition(nextDefinition);
              setDefinitionId(published.definitionId);
              setPublishedDefinition(nextDefinition);
              setStatus(`Published v${published.publicationVersion}`);
            }}
          />
        </Box>
        <Box hidden={mode !== "renderer"}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Form response capture</Typography>
          <FormRenderer
            key={definitionId}
            definition={publishedDefinition ?? definition}
            mode="new"
            uploadFile={formId && definitionId ? createHttpUploadHandler(apiBase, formId, definitionId) : undefined}
            onSubmit={async (values) => {
              if (!formId || !definitionId) {
                throw new Error("Publish before submit");
              }
              const payload = JSON.stringify({ formId, definitionId, values, uploadIds: definition.fields.filter(field => field.type === "single_file" || field.type === "multi_file").flatMap(field => Array.isArray(values[field.id]) ? values[field.id] as string[] : values[field.id] ? [String(values[field.id])] : []) });
              const result = await api<{ recordId: string }>("/api/records", {
                method: "POST",
                headers: {
                  "idempotency-key": submissionKey.current.keyFor(payload)
                },
                body: payload
              });
              submissionKey.current.committed();
              setStatus(`Submitted ${result.recordId}`);
            }}
          />
        </Box>
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
