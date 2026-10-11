import { ReactElement, useMemo, useState } from "react";
import { FormDefinition } from "@coderlifenet/form-core";

export type RendererMode = "new" | "edit" | "read_only" | "history" | "compact";

export type FormRendererProps = {
  definition: FormDefinition;
  mode: RendererMode;
  initialValues?: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
  onSubmit?: (values: Record<string, unknown>) => Promise<void> | void;
};

export function FormRenderer(props: FormRendererProps): ReactElement {
  const [values, setValues] = useState<Record<string, unknown>>(props.initialValues ?? {});
  const [errors, setErrors] = useState<Record<string, string>>(props.fieldErrors ?? {});
  const [formError, setFormError] = useState<string>("");

  const fieldsBySection = useMemo(() => {
    const map = new Map<string, typeof props.definition.fields>();
    for (const section of props.definition.sections.sort((a, b) => a.order - b.order)) {
      map.set(
        section.id,
        props.definition.fields
          .filter((field) => field.sectionId === section.id)
          .sort((a, b) => a.row - b.row || a.width - b.width)
      );
    }
    return map;
  }, [props.definition]);

  const editable = props.mode === "new" || props.mode === "edit" || props.mode === "compact";

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const nextErrors = validateRequired(props.definition, values);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
          setFormError("Check highlighted fields and retry.");
          return;
        }

        try {
          await props.onSubmit?.(values);
          setFormError("");
        } catch {
          setFormError("Submission failed. Your entries are preserved.");
        }
      }}
      aria-label="Form renderer"
    >
      {formError ? <div role="alert">{formError}</div> : null}
      {props.definition.sections
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <section key={section.id}>
            <h3>{section.title}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12 }}>
              {(fieldsBySection.get(section.id) ?? []).map((field) => {
                const error = errors[field.id];
                const disabled = !editable;
                const label = (
                  <label htmlFor={field.id}>
                    {field.label}
                    {field.required ? " *" : ""}
                    {field.tooltipText ? <span aria-label="Info"> ⓘ</span> : null}
                  </label>
                );

                if (field.type === "multiline") {
                  return (
                    <div key={field.id} style={{ gridColumn: `span ${field.width}` }}>
                      {label}
                      <textarea
                        id={field.id}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `${field.id}-error` : undefined}
                        disabled={disabled}
                        defaultValue={String(values[field.id] ?? field.defaultValue ?? "")}
                        onBlur={(event) => {
                          setValues((prev) => ({ ...prev, [field.id]: event.target.value }));
                        }}
                      />
                      {field.helpText ? <small>{field.helpText}</small> : null}
                      {error ? <div id={`${field.id}-error`}>{error}</div> : null}
                    </div>
                  );
                }

                return (
                  <div key={field.id} style={{ gridColumn: `span ${field.width}` }}>
                    {label}
                    <input
                      id={field.id}
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${field.id}-error` : undefined}
                      disabled={disabled}
                      defaultValue={String(values[field.id] ?? field.defaultValue ?? "")}
                      onBlur={(event) => {
                        setValues((prev) => ({ ...prev, [field.id]: event.target.value }));
                      }}
                    />
                    {field.helpText ? <small>{field.helpText}</small> : null}
                    {error ? <div id={`${field.id}-error`}>{error}</div> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      {editable ? <button type="submit">Submit</button> : null}
    </form>
  );
}

export type RecordRevision = {
  id: string;
  revisionNumber: number;
  savedAt: string;
  values: Record<string, unknown>;
};

export function RecordHistoryView(props: {
  definition: FormDefinition;
  revisions: RecordRevision[];
}): ReactElement {
  const [index, setIndex] = useState(0);
  const revision = props.revisions[index];

  return (
    <section aria-label="Record history">
      <h3>Revision history</h3>
      <div>
        {props.revisions.map((item, idx) => (
          <button key={item.id} onClick={() => setIndex(idx)} aria-pressed={idx === index} type="button">
            Revision {item.revisionNumber}
          </button>
        ))}
      </div>
      <div>
        <p>Saved: {revision.savedAt}</p>
        {props.definition.fields.map((field) => (
          <div key={field.id}>
            <strong>{field.label}:</strong> {String(revision.values[field.id] ?? "")}
          </div>
        ))}
      </div>
    </section>
  );
}

function validateRequired(definition: FormDefinition, values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of definition.fields) {
    if (!field.required) {
      continue;
    }
    const value = values[field.id];
    if (value === undefined || value === null || value === "") {
      errors[field.id] = `${field.label} is required`;
    }
  }
  return errors;
}
