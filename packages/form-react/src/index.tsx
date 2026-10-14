export { createFormApiClient, createMutationRetryKey, FormRequestError } from "./client.js";
import { FileField, type UploadHandler } from "./uploads.js";
export { createHttpUploadHandler, type UploadHandler } from "./uploads.js";
import { TrackingBoundary } from "@coderlifenet/ui-core/extensions";
import { ReactElement, useMemo, useState, useEffect, useId, useRef } from "react";
import { optionSchema, matchesSafeRegex, evaluateRule, FormDefinition, ValidationError } from "@coderlifenet/form-core";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  IconButton,
  Tooltip,
  Radio,
  RadioGroup,
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
  // Host-controlled identity for definition/version/record context boundaries.
  renderIdentity?: string;
  initialValues?: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
  sourceResolver?: (sourceId: string, values: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
  optionSourceResolver?: (sourceId: string, values: Record<string, unknown>, signal: AbortSignal) => Promise<Array<{ id: string; label: string }>>;
  uploadFile?: UploadHandler;
  onSubmit?: (values: Record<string, unknown>) => Promise<void> | void;
};

type FieldState = {
  visible: boolean;
  required: boolean;
  readonly: boolean;
  disabled: boolean;
};

export function FormRenderer(props: FormRendererProps): ReactElement {
  const instanceId = useId();
  const renderIdentity = props.renderIdentity ?? props.definition.metadata.formId;
  const formHelpId = `${instanceId}-instructions`;
  const [values, setValues] = useState<Record<string, unknown>>(initializeValues(props.definition, props.initialValues));
  const [errors, setErrors] = useState<Record<string, string>>(props.fieldErrors ?? {});
  const pendingSubmission = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>("");
  const identityRef = useRef(renderIdentity);
  const operationGeneration = useRef(0);
  const submitController = useRef<AbortController | null>(null);

  useEffect(() => { setErrors(props.fieldErrors ?? {}); }, [props.fieldErrors]);

  const fieldsBySection = useMemo(() => {
    const map = new Map<string, typeof props.definition.fields>();
    for (const section of [...props.definition.sections].sort((a, b) => a.order - b.order)) {
      map.set(
        section.id,
        props.definition.fields
          .filter((field) => field.sectionId === section.id)
          .sort((a, b) => a.row - b.row || a.width - b.width)
      );
    }
    return map;
  }, [props.definition]);

  const [sourceOptions, setSourceOptions] = useState<Record<string, Array<{ id: string; label: string }>>>({});
  const [sourceError, setSourceError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (identityRef.current === renderIdentity) return;
    identityRef.current = renderIdentity;
    operationGeneration.current += 1;
    submitController.current?.abort();
    submitController.current = null;
    pendingSubmission.current = false;
    setSubmitting(false);
    setValues(initializeValues(props.definition, props.initialValues));
    setErrors(props.fieldErrors ?? {});
    setSourceOptions({});
    setSourceError("");
    setFormError("");
    setRefresh(0);
  }, [renderIdentity, props.definition, props.initialValues, props.fieldErrors]);

  const resolverRef = useRef(props.optionSourceResolver);
  resolverRef.current = props.optionSourceResolver;
  const dependencies = JSON.stringify(props.definition.fields.filter(f => f.source?.kind === "options").map(f => [f.id, f.source, (f.source?.dependsOn ?? []).map(id => values[id])]));
  useEffect(() => {
    if (!resolverRef.current || props.mode === "history" || props.mode === "read_only") return;
    const generation = operationGeneration.current;
    const controller = new AbortController();
    setSourceError("");
    void Promise.all(props.definition.fields.filter(f => f.source?.kind === "options").map(async field => {
      try {
        const options = (await resolverRef.current!(field.source!.id, values, controller.signal)).map(option => optionSchema.parse(option));
        if (!controller.signal.aborted && generation === operationGeneration.current) setSourceOptions(prev => ({ ...prev, [field.id]: options }));
      } catch {
        if (!controller.signal.aborted && generation === operationGeneration.current) setSourceError("Options could not be refreshed. Your selections are preserved.");
      }
    }));
    return () => controller.abort();
  }, [dependencies, refresh, props.mode, renderIdentity]);

  const valueResolver = useRef(props.sourceResolver);
  valueResolver.current = props.sourceResolver;
  const valueDependencies = JSON.stringify(props.definition.fields.filter(f => f.source?.kind !== "options").map(f => [f.id, f.source, (f.source?.dependsOn ?? []).map(id => values[id])]));
  useEffect(() => {
    if (!valueResolver.current || props.mode === "history" || props.mode === "read_only") return;
    const generation = operationGeneration.current;
    const controller = new AbortController();
    const snapshot = values;
    for (const field of props.definition.fields) {
      const source = field.source;
      if (!source || source.kind === "options" || source.mode === "manual" || (source.mode === "create_only" && (props.mode !== "new" || snapshot[field.id] !== undefined))) continue;
      void valueResolver.current(source.id, snapshot, controller.signal).then(value => {
        if (controller.signal.aborted || generation !== operationGeneration.current || value === undefined) return;
        setValues(previous => {
          if (source.mode !== "display_only" && previous[field.id] !== snapshot[field.id]) return previous;
          return { ...previous, [field.id]: value };
        });
      }).catch(() => {
        if (!controller.signal.aborted && generation === operationGeneration.current) setSourceError("Source data could not be loaded. Your entries are preserved.");
      });
    }
    return () => controller.abort();
  }, [valueDependencies, refresh, props.mode, renderIdentity]);

  const editable = props.mode === "new" || props.mode === "edit" || props.mode === "compact";

  return (
    <TrackingBoundary id={props.definition.tracking?.id ?? "form"} {...props.definition.tracking} optOut={props.definition.tracking?.optOut ?? !props.definition.tracking}>
    <Box
      component="form"
      noValidate
      aria-busy={submitting}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pendingSubmission.current) return;
        const generation = operationGeneration.current;
        const sameIdentity = () => generation === operationGeneration.current && identityRef.current === renderIdentity;
        const controller = new AbortController();
        submitController.current?.abort();
        submitController.current = controller;
        pendingSubmission.current = true;
        setSubmitting(true);
        try {
        let submittedValues = values;

        try {
        if (props.sourceResolver) {
          submittedValues = { ...submittedValues };
          for (const field of props.definition.fields) {
            if (!field.source || field.source.kind === "options") {
              continue;
            }
            if (submittedValues[field.id] !== undefined && field.source.mode !== "display_only") {
              continue;
            }
            // Resolve source values at submit time to avoid stale host values.
            submittedValues[field.id] = await props.sourceResolver(field.source.id, submittedValues, controller.signal);
            if (!sameIdentity()) {
              return;
            }
          }
        }

        } catch {
          if (!sameIdentity()) {
            return;
          }
          setFormError("Source data could not be verified. Your entries are preserved.");
          return;
        }

        if (!sameIdentity()) {
          return;
        }

        const fieldErrors = validateRecordPayload(props.definition, submittedValues);
        setErrors(fieldErrorsToMap(fieldErrors));
        if (fieldErrors.length > 0) {
          setFormError("Check highlighted fields and retry.");
          document.getElementById(`${instanceId}-${fieldErrors[0].fieldId}`)?.focus();
          return;
        }

        try {
          if (!sameIdentity()) {
            return;
          }
          await props.onSubmit?.(submittedValues);
          if (!sameIdentity()) {
            return;
          }
          setFormError("");
        } catch (error) {
          if (!sameIdentity()) {
            return;
          }
          const fieldErrors = (error as { fieldErrors?: ValidationError[] })?.fieldErrors;
          if (Array.isArray(fieldErrors)) setErrors(fieldErrorsToMap(fieldErrors));
          const status = (error as { status?: number })?.status;
          setFormError(status === 401 ? "Your session expired. Sign in again; your entries are preserved." : status === 403 ? "Your permission changed. Your entries are preserved; request access before retrying." : "Submission failed. Your entries are preserved.");
        }
        } finally {
          if (submitController.current === controller) {
            submitController.current = null;
          }
          if (sameIdentity()) {
            pendingSubmission.current = false;
            setSubmitting(false);
          }
        }
      }}
      aria-label={props.definition.accessibility?.label ?? props.definition.metadata.name}
      aria-describedby={formHelpId}
    >
      <Typography id={formHelpId}>{[props.definition.accessibility?.description, props.definition.accessibility?.instructions].filter(Boolean).join(" ")}</Typography>
      {sourceError && <Alert severity="error">{sourceError}<Button onClick={() => setRefresh(value => value + 1)}>Retry options</Button></Alert>}
      {props.optionSourceResolver && editable && <Button onClick={() => setRefresh(value => value + 1)}>Refresh options</Button>}
      {formError ? <Alert severity="error" sx={{ mb: 1 }}>{formError}</Alert> : null}
      {[...props.definition.sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <Box key={section.id} component="fieldset" sx={{ mb: 1.5, border: 0, p: 0, m: 0 }}>
            <Typography variant="h6" component="legend" sx={{ mb: 1 }}>{section.title}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 1.5 }}>
              {(fieldsBySection.get(section.id) ?? []).map((field) => {
                const state = deriveFieldState(props.definition, field.id, values);
                if (!state.visible) {
                  return null;
                }

                const error = errors[field.id];
                const disabled = !editable || state.disabled || submitting;
                const readOnly = !editable || state.readonly;
                const value = values[field.id];

                const label = field.label;
                const inputId = `${instanceId}-${field.id}`;
                const helperId = `${inputId}-help`;
                const helpText = error ?? ([field.helpText, field.accessibility?.description, field.accessibility?.instructions].filter(Boolean).join(" ") || " ");
                const inputA11y = { "aria-label": field.accessibility?.label, "aria-describedby": helperId, "aria-invalid": Boolean(error), "aria-required": state.required };
                return <TrackingBoundary key={field.id} id={field.tracking?.id ?? field.id} {...field.tracking}><Box sx={{ gridColumn: { xs: "span 12", sm: `span ${field.width}` }, minWidth: 0 }}>
                  {field.tooltipText && <FieldTooltip text={field.tooltipText} label={field.label} />}
                  {(() => {

                if (field.type === "single_file" || field.type === "multi_file") {
                  return <FileField id={inputId} label={label} multiple={field.type === "multi_file"} disabled={disabled || readOnly} required={state.required} value={value} error={error} upload={props.uploadFile ? (_id,file,signal,progress) => props.uploadFile!(field.id,file,signal,progress) : undefined} onChange={value => setFieldValue(field.id,value,setValues)} />;
                }
                if (field.type === "multiline") {
                  return (
                    <TextField fullWidth
                      key={field.id}
                      sx={{ gridColumn: { xs: "span 12", sm: `span ${field.width}` } }}
                        id={inputId}
                      label={label}
                      required={state.required}
                      placeholder={field.placeholder}
                      multiline
                      minRows={3}
                      disabled={disabled}
                      slotProps={{ htmlInput: { readOnly, ...inputA11y }, formHelperText: { id: helperId } }}
                      value={String(value ?? "")}
                      onChange={(event) => setFieldValue(field.id, event.target.value, setValues)}
                      onBlur={() => setErrors(previous => { const next = { ...previous }; delete next[field.id]; return { ...next, ...fieldErrorsToMap(validateRecordPayload(props.definition, values).filter(error => error.fieldId === field.id)) }; })}
                      helperText={helpText}
                      error={Boolean(error)}
                    />
                  );
                }

                if (field.type === "single_select" || field.type === "radio" || field.type === "multi_select") {
                  const options = sourceOptions[field.id] ?? field.options ?? [];
                  const selected = field.type === "single_select" || field.type === "radio" ? String(value ?? "") : ((value ?? []) as string[]);
                  if (field.type === "radio") {
                    return (
                      <FormControl key={field.id} sx={{ gridColumn: { xs: "span 12", sm: `span ${field.width}` } }} error={Boolean(error)} disabled={disabled}>
                        <Typography id={`${inputId}-label`} component="label" variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {label}
                        </Typography>
                        <RadioGroup
                          aria-labelledby={`${inputId}-label`}
                          name={inputId}
                          value={selected}
                          onChange={(event) => setFieldValue(field.id, event.target.value, setValues)}
                        >
                          {options.map((option) => (
                            <FormControlLabel
                              key={option.id}
                              value={option.id}
                              control={<Radio slotProps={{ input: { ...inputA11y, readOnly } }} />}
                              label={option.label}
                              disabled={disabled || readOnly}
                            />
                          ))}
                        </RadioGroup>
                        <FormHelperText id={helperId}>{helpText}</FormHelperText>
                      </FormControl>
                    );
                  }
                  return (
                    <FormControl key={field.id} sx={{ gridColumn: { xs: "span 12", sm: `span ${field.width}` } }} error={Boolean(error)} disabled={disabled}>
                      <InputLabel id={`${inputId}-label`}>{label}</InputLabel>
                      <Select
                        labelId={`${inputId}-label`}
                        label={label}
                      required={state.required}
                        id={inputId}
                        inputProps={{ ...inputA11y, readOnly }}
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
                        {(field.type === "single_select" ? [String(value ?? "")] : Array.isArray(value) ? value.map(String) : []).filter(id => id && !options.some(option => option.id === id)).map(id => <MenuItem key={id} value={id} disabled>{field.options?.find(option => option.id === id)?.label ?? "Unavailable saved selection"}</MenuItem>)}
                        {options.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText id={helperId}>{helpText}</FormHelperText>
                    </FormControl>
                  );
                }

                if (field.type === "checkbox") {
                  return (
                    <Box key={field.id} sx={{ gridColumn: { xs: "span 12", sm: `span ${field.width}` } }}>
                      <FormControlLabel
                        label={label}
                      required={state.required}
                        control={
                          <Checkbox
                          id={inputId}
                            slotProps={{ input: inputA11y }}
                            checked={Boolean(value)}
                            disabled={disabled || readOnly}
                            onChange={(event) => setFieldValue(field.id, event.target.checked, setValues)}
                          />
                        }
                      />
                      <FormHelperText id={helperId} error={Boolean(error)}>{helpText}</FormHelperText>
                    </Box>
                  );
                }

                return (
                  <TextField
                    key={field.id}
                    sx={{ gridColumn: { xs: "span 12", sm: `span ${field.width}` } }}
                      id={inputId}
                    label={label}
                      required={state.required}
                      placeholder={field.placeholder}
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
                      disabled={disabled}
                    slotProps={{ htmlInput: { readOnly, ...inputA11y }, formHelperText: { id: helperId } }}
                      value={String(value ?? "")}
                      onChange={(event) => {
                        if (field.type === "number") {
                          const parsed = Number(event.target.value);
                          setFieldValue(field.id, Number.isNaN(parsed) ? event.target.value : parsed, setValues);
                          return;
                        }
                        setFieldValue(field.id, event.target.value, setValues);
                      }}
                      onBlur={() => setErrors(previous => { const next = { ...previous }; delete next[field.id]; return { ...next, ...fieldErrorsToMap(validateRecordPayload(props.definition, values).filter(error => error.fieldId === field.id)) }; })}
                      helperText={helpText}
                      error={Boolean(error)}
                    />
                );
              })()}</Box></TrackingBoundary>;
              })}
              </Box>
            </Box>
        ))}
        {editable ? <Button type="submit" variant="contained" disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button> : null}
      </Box>
    </TrackingBoundary>
  );
}

export type RecordRevision = {
  id: string;
  revisionNumber: number;
  savedAt: string;
  values: Record<string, unknown>;
  definition?: FormDefinition;
  selectedLabels?: Record<string, string>;
};

export function RecordHistoryView(props: {
  definition: FormDefinition;
  revisions: RecordRevision[];
}): ReactElement {
  const [index, setIndex] = useState(0);
  const revision = props.revisions[index];
  const definition = revision?.definition ?? props.definition;
  if (!revision) return <Typography role="status">No revisions available.</Typography>;

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
            <Box component="strong">{field.label}:</Box> {(Array.isArray(revision.values[field.id]) ? revision.values[field.id] as unknown[] : [revision.values[field.id]]).map(value => revision.selectedLabels?.[String(value)] ?? field.options?.find(option => option.id === value)?.label ?? String(value ?? "")).join(", ")}
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
          if (!matchesSafeRegex(field.validation.regex, value)) {
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
  let readonly = field.source?.mode === "display_only";
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

function FieldTooltip({ text, label }: { text: string; label: string }): ReactElement {
  const [open, setOpen] = useState(false);
  return <Tooltip title={text} open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)}>
    <IconButton size="small" aria-label={`${label} information`} aria-expanded={open} onClick={() => setOpen(previous => !previous)} sx={{ mb: 0.5 }}><Box component="span" sx={{ border: "1px solid currentColor", borderRadius: "50%", width: 18, height: 18, fontSize: 14, lineHeight: "18px" }}>i</Box></IconButton>
  </Tooltip>;
}
