import { ReactElement, useMemo, useState } from "react";
import { evaluateRule, FormDefinition, ValidationError } from "@coderlifenet/form-core";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@coderlifenet/ui-core";

export type RendererMode = "new" | "edit" | "read_only" | "history" | "compact";

export type FormRendererProps = {
  definition: FormDefinition;
  mode: RendererMode;
  initialValues?: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
  sourceResolver?: (sourceId: string, values: Record<string, unknown>) => Promise<unknown>;
  onSubmit?: (values: Record<string, unknown>) => Promise<void> | void;
};

type FieldState = {
  visible: boolean;
  required: boolean;
  readonly: boolean;
  disabled: boolean;
};

export function FormRenderer(props: FormRendererProps): ReactElement {
  const [values, setValues] = useState<Record<string, unknown>>(initializeValues(props.definition, props.initialValues));
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
    <Box
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        let submittedValues = values;

        if (props.sourceResolver) {
          submittedValues = { ...submittedValues };
          for (const field of props.definition.fields) {
            if (!field.source) {
              continue;
            }
            if (submittedValues[field.id] !== undefined && field.source.mode !== "display_only") {
              continue;
            }
            // Resolve source values at submit time to avoid stale host values.
            submittedValues[field.id] = await props.sourceResolver(field.source.id, submittedValues);
          }
        }

        const fieldErrors = validateRecordPayload(props.definition, submittedValues);
        setErrors(fieldErrorsToMap(fieldErrors));
        if (fieldErrors.length > 0) {
          setFormError("Check highlighted fields and retry.");
          return;
        }

        try {
          await props.onSubmit?.(submittedValues);
          setFormError("");
        } catch {
          setFormError("Submission failed. Your entries are preserved.");
        }
      }}
      aria-label="Form renderer"
    >
      {formError ? <Alert severity="error" sx={{ mb: 1 }}>{formError}</Alert> : null}
      {props.definition.sections
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <Box key={section.id} component="section" sx={{ mb: 1.5 }}>
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>{section.title}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 1.5 }}>
              {(fieldsBySection.get(section.id) ?? []).map((field) => {
                const state = deriveFieldState(props.definition, field.id, values);
                if (!state.visible) {
                  return null;
                }

                const error = errors[field.id];
                const disabled = !editable || state.disabled;
                const readOnly = !editable || state.readonly;
                const value = values[field.id];

                const label = `${field.label}${state.required ? " *" : ""}`;

                if (field.type === "multiline") {
                  return (
                    <TextField
                      key={field.id}
                      sx={{ gridColumn: `span ${field.width}` }}
                        id={field.id}
                      label={label}
                      multiline
                      minRows={3}
                      disabled={disabled}
                      slotProps={{ htmlInput: { readOnly } }}
                      value={String(value ?? "")}
                      onChange={(event) => setFieldValue(field.id, event.target.value, setValues)}
                      onBlur={() => setErrors(fieldErrorsToMap(validateRecordPayload(props.definition, values)))}
                      helperText={error ?? field.helpText ?? " "}
                      error={Boolean(error)}
                    />
                  );
                }

                if (field.type === "single_select" || field.type === "multi_select") {
                  const selected = field.type === "single_select" ? String(value ?? "") : ((value ?? []) as string[]);
                  return (
                    <FormControl key={field.id} sx={{ gridColumn: `span ${field.width}` }} error={Boolean(error)} disabled={disabled}>
                      <InputLabel id={`${field.id}-label`}>{label}</InputLabel>
                      <Select
                        labelId={`${field.id}-label`}
                        label={label}
                        id={field.id}
                        multiple={field.type === "multi_select"}
                        value={field.type === "single_select" ? selected : selected}
                        onChange={(event) => {
                          if (field.type === "single_select") {
                            setFieldValue(field.id, event.target.value, setValues);
                            return;
                          }
                          const multiValues = Array.isArray(event.target.value)
                            ? event.target.value
                            : String(event.target.value).split(",").filter(Boolean);
                          setFieldValue(field.id, multiValues, setValues);
                        }}
                      >
                        {field.type === "single_select" ? <MenuItem value="">Select an option</MenuItem> : null}
                        {(field.options ?? []).map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>{error ?? field.helpText ?? " "}</FormHelperText>
                    </FormControl>
                  );
                }

                if (field.type === "checkbox") {
                  return (
                    <Box key={field.id} sx={{ gridColumn: `span ${field.width}` }}>
                      <FormControlLabel
                        label={label}
                        control={
                          <Checkbox
                          id={field.id}
                            checked={Boolean(value)}
                            disabled={disabled}
                            onChange={(event) => setFieldValue(field.id, event.target.checked, setValues)}
                          />
                        }
                      />
                      <FormHelperText error={Boolean(error)}>{error ?? field.helpText ?? " "}</FormHelperText>
                    </Box>
                  );
                }

                return (
                  <TextField
                    key={field.id}
                    sx={{ gridColumn: `span ${field.width}` }}
                      id={field.id}
                    label={label}
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
                      disabled={disabled}
                    slotProps={{ htmlInput: { readOnly } }}
                      value={String(value ?? "")}
                      onChange={(event) => {
                        if (field.type === "number") {
                          const parsed = Number(event.target.value);
                          setFieldValue(field.id, Number.isNaN(parsed) ? event.target.value : parsed, setValues);
                          return;
                        }
                        setFieldValue(field.id, event.target.value, setValues);
                      }}
                      onBlur={() => setErrors(fieldErrorsToMap(validateRecordPayload(props.definition, values)))}
                      helperText={error ?? field.helpText ?? " "}
                      error={Boolean(error)}
                    />
                );
              })}
              </Box>
            </Box>
        ))}
        {editable ? <Button type="submit" variant="contained">Submit</Button> : null}
      </Box>
  );
}

export type RecordRevision = {
  id: string;
  revisionNumber: number;
  savedAt: string;
  values: Record<string, unknown>;
  definition?: FormDefinition;
};

export function RecordHistoryView(props: {
  definition: FormDefinition;
  revisions: RecordRevision[];
}): ReactElement {
  const [index, setIndex] = useState(0);
  const revision = props.revisions[index];
  const definition = revision?.definition ?? props.definition;

  return (
    <Box component="section" aria-label="Record history">
      <Typography variant="h6" component="h3">Revision history</Typography>
      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
        {props.revisions.map((item, idx) => (
          <Button key={item.id} onClick={() => setIndex(idx)} aria-pressed={idx === index} type="button" variant={idx === index ? "contained" : "outlined"}>
            Revision {item.revisionNumber}
          </Button>
        ))}
      </Stack>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Saved: {revision.savedAt}</Typography>
        {definition.fields.map((field) => (
          <Typography key={field.id} variant="body2" sx={{ mb: 0.5 }}>
            <Box component="strong">{field.label}:</Box> {String(revision.values[field.id] ?? "")}
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}

export function validateRecordPayload(definition: FormDefinition, values: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of definition.fields) {
    const state = deriveFieldState(definition, field.id, values);
    if (!state.visible) {
      continue;
    }

    const value = values[field.id];
    if (state.required && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))) {
      errors.push({ fieldId: field.id, code: "REQUIRED", message: `${field.label} is required` });
      continue;
    }

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (field.validation) {
      const asString = typeof value === "string" ? value : String(value);
      if (field.validation.minLength !== undefined && asString.length < field.validation.minLength) {
        errors.push({ fieldId: field.id, code: "MIN_LENGTH", message: `${field.label} must be at least ${field.validation.minLength} characters` });
      }
      if (field.validation.maxLength !== undefined && asString.length > field.validation.maxLength) {
        errors.push({ fieldId: field.id, code: "MAX_LENGTH", message: `${field.label} must be at most ${field.validation.maxLength} characters` });
      }
      if (typeof value === "number") {
        if (field.validation.minNumber !== undefined && value < field.validation.minNumber) {
          errors.push({ fieldId: field.id, code: "MIN_NUMBER", message: `${field.label} must be >= ${field.validation.minNumber}` });
        }
        if (field.validation.maxNumber !== undefined && value > field.validation.maxNumber) {
          errors.push({ fieldId: field.id, code: "MAX_NUMBER", message: `${field.label} must be <= ${field.validation.maxNumber}` });
        }
      }
      if (field.validation.regex && typeof value === "string") {
        try {
          const regex = new RegExp(field.validation.regex);
          if (!regex.test(value)) {
            errors.push({
              fieldId: field.id,
              code: "REGEX_MISMATCH",
              message: field.validation.regexMessage ?? `${field.label} has an invalid format`
            });
          }
        } catch {
          errors.push({
            fieldId: field.id,
            code: "REGEX_PATTERN_INVALID",
            message: `${field.label} has an invalid validation pattern`
          });
        }
      }
    }
  }

  return errors;
}

function initializeValues(definition: FormDefinition, initialValues?: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(initialValues ?? {}) };
  for (const field of definition.fields) {
    if (next[field.id] !== undefined) {
      continue;
    }
    if (field.defaultValue !== undefined) {
      next[field.id] = field.defaultValue;
    }
  }
  return next;
}

function deriveFieldState(definition: FormDefinition, fieldId: string, values: Record<string, unknown>): FieldState {
  const field = definition.fields.find((item) => item.id === fieldId);
  if (!field) {
    return { visible: false, required: false, readonly: false, disabled: false };
  }

  const hasVisibleRules = field.rules.some((rule) => rule.behavior === "visible");
  let visible = hasVisibleRules ? false : true;
  let required = field.required;
  let readonly = false;
  let disabled = false;

  for (const rule of field.rules) {
    const active = evaluateRule(values[rule.sourceFieldId], rule.operator, rule.value);
    if (!active) {
      continue;
    }
    if (rule.behavior === "required") {
      required = true;
    }
    if (rule.behavior === "readonly") {
      readonly = true;
    }
    if (rule.behavior === "disabled") {
      disabled = true;
    }
    if (rule.behavior === "visible") {
      visible = true;
    }
  }

  return { visible, required, readonly, disabled };
}

function setFieldValue(
  fieldId: string,
  value: unknown,
  setValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
): void {
  setValues((prev) => ({ ...prev, [fieldId]: value }));
}

function fieldErrorsToMap(fieldErrors: ValidationError[]): Record<string, string> {
  const next: Record<string, string> = {};
  for (const item of fieldErrors) {
    next[item.fieldId] = item.message;
  }
  return next;
}
