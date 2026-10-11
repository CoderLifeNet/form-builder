import { ReactElement, useMemo, useState } from "react";
import { createStableId, FormDefinition } from "@coderlifenet/form-core";

export type ManagedForm = {
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  publishedVersion?: number;
  hasDraft: boolean;
  definition: FormDefinition;
};

export function FormManager(props: {
  forms: ManagedForm[];
  onOpenBuilder: (formId: string) => void;
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
    <section aria-label="Form manager">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Forms</h2>
          <p>Design once, publish immutable versions.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button aria-label="Import" title="Import" type="button" onClick={props.onImportAsNew}>
            ⬆
          </button>
          <button type="button">Create form</button>
        </div>
      </header>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search forms" />
        <select value={status} onChange={(event) => setStatus(event.target.value as "all" | "draft" | "archived")}>
          <option value="all">Active</option>
          <option value="draft">With draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <ul>
        {rows.map((form) => (
          <li key={form.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}>
            <button type="button" onClick={() => props.onOpenBuilder(form.id)}>
              {form.name}
            </button>
            <span>
              {form.archived
                ? "Archived"
                : form.publishedVersion
                  ? `Published v${form.publishedVersion}${form.hasDraft ? " + draft" : ""}`
                  : "Draft"}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button aria-label="Duplicate" title="Duplicate" type="button" onClick={() => props.onDuplicate(form.id)}>
                ⧉
              </button>
              <button aria-label="Export" title="Export" type="button" onClick={() => props.onExport(form.id)}>
                ⭳
              </button>
              <button
                aria-label={form.archived ? "Restore" : "Archive"}
                title={form.archived ? "Restore" : "Archive"}
                type="button"
                onClick={() => props.onArchiveToggle(form.id)}
              >
                {form.archived ? "↺" : "🗄"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FormBuilder(props: {
  initialDefinition: FormDefinition;
  onSaveDraft: (definition: FormDefinition) => Promise<void> | void;
  onPublish: (definition: FormDefinition) => Promise<void> | void;
}): ReactElement {
  const [definition, setDefinition] = useState<FormDefinition>(props.initialDefinition);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(props.initialDefinition.fields[0]?.id ?? null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");

  const selectedField = definition.fields.find((field: FormDefinition["fields"][number]) => field.id === selectedFieldId) ?? null;

  const addField = (type: FormDefinition["fields"][number]["type"]): void => {
    const sectionId = definition.sections[0]?.id ?? createStableId("section");
    const id = createStableId("field");
    setDefinition((prev: FormDefinition) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          id,
          key: id,
          type,
          label: "New field",
          required: false,
          sectionId,
          row: prev.fields.length,
          width: 6,
          rules: []
        }
      ]
    }));
    setSelectedFieldId(id);
    setSaveState("unsaved");
  };

  return (
    <section aria-label="Form builder">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Builder</h2>
        <div>
          <span style={{ marginRight: 12 }}>Status: {saveState}</span>
          <button
            type="button"
            onClick={async () => {
              setSaveState("saving");
              try {
                await props.onSaveDraft(definition);
                setSaveState("saved");
              } catch {
                setSaveState("error");
              }
            }}
          >
            Save draft
          </button>
          <button type="button" onClick={() => props.onPublish(definition)}>
            Publish
          </button>
        </div>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 300px", gap: 12 }}>
        <aside>
          <h3>Palette</h3>
          {[
            ["text", "Text"],
            ["multiline", "Long text"],
            ["number", "Number"],
            ["date", "Date"],
            ["checkbox", "Checkbox"],
            ["single_select", "Single select"],
            ["multi_select", "Multi select"],
            ["url", "URL"],
            ["single_file", "Single file"],
            ["multi_file", "Multiple files"]
          ].map(([type, label]) => (
            <button key={type} type="button" onClick={() => addField(type as any)}>
              {label}
            </button>
          ))}
        </aside>
        <main>
          <h3>Layout</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 8 }}>
            {definition.fields.map((field: FormDefinition["fields"][number]) => (
              <button
                key={field.id}
                type="button"
                style={{ gridColumn: `span ${field.width}`, border: selectedFieldId === field.id ? "2px solid #0f5ad8" : undefined }}
                onClick={() => setSelectedFieldId(field.id)}
              >
                {field.label}
              </button>
            ))}
          </div>
        </main>
        <aside>
          <h3>Properties</h3>
          {selectedField ? (
            <div>
              <label htmlFor="field_label">Label</label>
              <input
                id="field_label"
                value={selectedField.label}
                onChange={(event) => {
                  const value = event.target.value;
                  setDefinition((prev: FormDefinition) => ({
                    ...prev,
                    fields: prev.fields.map((field: FormDefinition["fields"][number]) =>
                      field.id === selectedField.id ? { ...field, label: value } : field
                    )
                  }));
                  setSaveState("unsaved");
                }}
              />
              <label htmlFor="field_required">Required</label>
              <input
                id="field_required"
                type="checkbox"
                checked={selectedField.required}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setDefinition((prev: FormDefinition) => ({
                    ...prev,
                    fields: prev.fields.map((field: FormDefinition["fields"][number]) =>
                      field.id === selectedField.id ? { ...field, required: checked } : field
                    )
                  }));
                  setSaveState("unsaved");
                }}
              />
            </div>
          ) : (
            <p>Select a field</p>
          )}
        </aside>
      </div>
    </section>
  );
}

export function exportDefinition(definition: FormDefinition): string {
  return JSON.stringify(
    {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      definition
    },
    null,
    2
  );
}

export function importDefinition(json: string): FormDefinition {
  const parsed = JSON.parse(json) as { definition: FormDefinition };
  return parsed.definition;
}
