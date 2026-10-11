import { useMemo, useState } from "react";
import { FormBuilder, FormManager, ManagedForm } from "@coderlifenet/form-builder";
import { FormRenderer } from "@coderlifenet/form-react";

const defaultDefinition = {
  metadata: {
    formId: "workspace-demo",
    name: "Workspace service request",
    description: "Parent default form"
  },
  sections: [
    { id: "s1", title: "Details", order: 0 },
    { id: "s2", title: "Request", order: 1 }
  ],
  fields: [
    { id: "f1", key: "first_name", type: "text", label: "First name", sectionId: "s1", row: 0, width: 6, required: true, rules: [] },
    { id: "f2", key: "last_name", type: "text", label: "Last name", sectionId: "s1", row: 0, width: 6, required: true, rules: [] },
    { id: "f3", key: "title", type: "text", label: "Request title", sectionId: "s2", row: 0, width: 12, required: true, rules: [] }
  ],
  dependencyVersions: {
    "profile.first_name": "1",
    "profile.last_name": "1"
  }
};

const seedForms: ManagedForm[] = [
  {
    id: "form_workspace_default",
    name: "Workspace default",
    archived: false,
    hasDraft: true,
    publishedVersion: 1,
    definition: defaultDefinition as any
  },
  {
    id: "form_project_override",
    name: "Project override",
    archived: false,
    hasDraft: false,
    publishedVersion: 2,
    definition: defaultDefinition as any
  }
];

export function App(): JSX.Element {
  const [view, setView] = useState<"manager" | "builder" | "capture">("manager");
  const [forms, setForms] = useState<ManagedForm[]>(seedForms);
  const [activeId, setActiveId] = useState(seedForms[0].id);

  const active = useMemo(() => forms.find((form) => form.id === activeId) ?? forms[0], [forms, activeId]);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <h1>Workspace/project host example</h1>
      <p>
        Demonstrates parent defaults, project override, and protected profile-bound fields. Development identity is selected by
        host headers in the service layer.
      </p>
      <nav style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setView("manager")}>Manager</button>
        <button type="button" onClick={() => setView("builder")}>Builder</button>
        <button type="button" onClick={() => setView("capture")}>Capture</button>
      </nav>

      {view === "manager" ? (
        <FormManager
          forms={forms}
          onOpenBuilder={(formId) => {
            setActiveId(formId);
            setView("builder");
          }}
          onDuplicate={(formId) => {
            const source = forms.find((form) => form.id === formId);
            if (!source) {
              return;
            }
            setForms((prev) => [
              ...prev,
              {
                ...source,
                id: `copy_${Date.now()}`,
                name: `${source.name} copy`,
                hasDraft: true,
                publishedVersion: undefined,
                archived: false
              }
            ]);
          }}
          onExport={() => {
            // Example only: full export/import lives in package API and server endpoints.
          }}
          onArchiveToggle={(formId) => {
            setForms((prev) =>
              prev.map((form) => (form.id === formId ? { ...form, archived: !form.archived } : form))
            );
          }}
          onImportAsNew={() => {
            setForms((prev) => [
              ...prev,
              {
                id: `imported_${Date.now()}`,
                name: "Imported draft",
                archived: false,
                hasDraft: true,
                definition: defaultDefinition as any
              }
            ]);
          }}
        />
      ) : null}

      {view === "builder" ? (
        <FormBuilder
          initialDefinition={active.definition as any}
          onSaveDraft={async (definition) => {
            setForms((prev) =>
              prev.map((form) =>
                form.id === active.id
                  ? {
                      ...form,
                      definition: definition as any,
                      hasDraft: true
                    }
                  : form
              )
            );
          }}
          onPublish={async (definition) => {
            setForms((prev) =>
              prev.map((form) =>
                form.id === active.id
                  ? {
                      ...form,
                      definition: definition as any,
                      hasDraft: false,
                      publishedVersion: (form.publishedVersion ?? 0) + 1
                    }
                  : form
              )
            );
          }}
        />
      ) : null}

      {view === "capture" ? (
        <FormRenderer
          definition={active.definition as any}
          mode="new"
          onSubmit={async () => {
            alert("Submitted in workspace example");
          }}
        />
      ) : null}
    </main>
  );
}
