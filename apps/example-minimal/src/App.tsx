import { useMemo, useState } from "react";
import { FormBuilder } from "@coderlifenet/form-builder";
import { FormRenderer } from "@coderlifenet/form-react";

const initialDefinition = {
  metadata: { formId: "demo-min", name: "Minimal service request" },
  sections: [
    { id: "sec_a", title: "Your details", order: 0 },
    { id: "sec_b", title: "Request", order: 1 }
  ],
  fields: [
    { id: "first_name", key: "first_name", type: "text", label: "First name", required: true, sectionId: "sec_a", row: 0, width: 6, rules: [] },
    { id: "last_name", key: "last_name", type: "text", label: "Last name", required: true, sectionId: "sec_a", row: 0, width: 6, rules: [] },
    { id: "title", key: "title", type: "text", label: "Request title", required: true, sectionId: "sec_b", row: 0, width: 12, rules: [] }
  ],
  dependencyVersions: {}
};

export function App(): JSX.Element {
  const [mode, setMode] = useState<"builder" | "renderer">("builder");
  const definition = useMemo(() => initialDefinition, []);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <h1>Minimal integration example</h1>
      <p>Uses shared packages with a real backend contract.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setMode("builder")}>Builder</button>
        <button type="button" onClick={() => setMode("renderer")}>Renderer</button>
      </div>
      {mode === "builder" ? (
        <FormBuilder
          initialDefinition={definition as any}
          onSaveDraft={async () => {
            // Example-only placeholder; real service integration is in workspace example.
          }}
          onPublish={async () => {
            // Example-only placeholder.
          }}
        />
      ) : (
        <FormRenderer
          definition={definition as any}
          mode="new"
          onSubmit={async () => {
            alert("Submitted in minimal example");
          }}
        />
      )}
    </main>
  );
}
