import {
  evaluateRule,
  type FieldType,
  type FormDefinition,
  type PublishedDefinition,
  testSafeRegex,
  type ValidationError,
  validateDefinition
} from "@coderlifenet/form-core";
import { z } from "zod";

export type SourceResolver = (sourceId: string, payload: Record<string, unknown>) => Promise<unknown>;

export async function applyDefinitionSources(
  definition: FormDefinition | PublishedDefinition,
  values: Record<string, unknown>,
  resolveSource: SourceResolver
): Promise<Record<string, unknown>> {
  const next = { ...values };

  for (const field of definition.fields) {
    const source = field.source;
    if (!source) {
      continue;
    }

    const existing = next[field.id];
    if (existing !== undefined && source.mode !== "display_only") {
      continue;
    }

    const resolved = await resolveSource(source.id, next);
    if (resolved !== undefined) {
      next[field.id] = resolved;
    }
  }

  return next;
}

export async function validateSubmissionAgainstDefinition(
  definition: FormDefinition | PublishedDefinition,
  values: Record<string, unknown>
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const fieldMap = new Map(definition.fields.map((field) => [field.id, field]));

  for (const field of definition.fields) {
    const state = deriveFieldState(field.id, definition, values);
    if (!state.visible) {
      continue;
    }

    const value = values[field.id];
    if (state.required && isMissingValue(value)) {
      errors.push({ fieldId: field.id, code: "REQUIRED", message: `${field.label} is required` });
      continue;
    }

    if (isMissingValue(value)) {
      continue;
    }

    const typeError = validateFieldType(field.type, value, field.label, field.id);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    if (field.options && (field.type === "single_select" || field.type === "multi_select")) {
      const allowed = new Set(field.options.map((option) => option.id));
      const selected = field.type === "single_select" ? [String(value)] : (value as unknown[]).map((item) => String(item));
      const invalid = selected.find((item) => !allowed.has(item));
      if (invalid) {
        errors.push({
          fieldId: field.id,
          code: "INVALID_OPTION",
          message: `${field.label} includes an unavailable option`
        });
      }
    }

    if (field.validation) {
      const stringValue = typeof value === "string" ? value : String(value);
      if (field.validation.minLength !== undefined && stringValue.length < field.validation.minLength) {
        errors.push({
          fieldId: field.id,
          code: "MIN_LENGTH",
          message: field.validation.regexMessage ?? `${field.label} must be at least ${field.validation.minLength} characters`
        });
      }
      if (field.validation.maxLength !== undefined && stringValue.length > field.validation.maxLength) {
        errors.push({
          fieldId: field.id,
          code: "MAX_LENGTH",
          message: `${field.label} must be at most ${field.validation.maxLength} characters`
        });
      }

      if (typeof value === "number") {
        if (field.validation.minNumber !== undefined && value < field.validation.minNumber) {
          errors.push({
            fieldId: field.id,
            code: "MIN_NUMBER",
            message: `${field.label} must be >= ${field.validation.minNumber}`
          });
        }
        if (field.validation.maxNumber !== undefined && value > field.validation.maxNumber) {
          errors.push({
            fieldId: field.id,
            code: "MAX_NUMBER",
            message: `${field.label} must be <= ${field.validation.maxNumber}`
          });
        }
      }

      if (field.validation.regex && typeof value === "string") {
        try {
          const matches = await testSafeRegex(field.validation.regex, value);
          if (!matches) {
            errors.push({
              fieldId: field.id,
              code: "REGEX_MISMATCH",
              message: field.validation.regexMessage ?? `${field.label} has an invalid format`
            });
          }
        } catch {
          errors.push({
            fieldId: field.id,
            code: "REGEX_UNSAFE",
            message: `${field.label} uses an unsupported or unsafe regex pattern`
          });
        }
      }
    }

    for (const rule of field.rules) {
      if (!fieldMap.has(rule.sourceFieldId)) {
        errors.push({
          fieldId: field.id,
          code: "INVALID_RULE_SOURCE",
          message: `${field.label} references an unknown dependency`
        });
      }
    }
  }

  return errors;
}

export function deriveFieldState(
  fieldId: string,
  definition: FormDefinition | PublishedDefinition,
  values: Record<string, unknown>
): { visible: boolean; required: boolean; readonly: boolean; disabled: boolean } {
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
    const sourceValue = values[rule.sourceFieldId];
    const active = evaluateRule(sourceValue, rule.operator, rule.value);
    if (!active) {
      continue;
    }

    if (rule.behavior === "visible") {
      visible = true;
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
  }

  return { visible, required, readonly, disabled };
}

export function exportDefinitionEnvelope(definition: FormDefinition): {
  formatVersion: number;
  definition: FormDefinition;
  dependencies: Record<string, string>;
} {
  const validated = validateDefinition(definition);
  return {
    formatVersion: 1,
    definition: validated,
    dependencies: validated.dependencyVersions
  };
}

export function importDefinitionEnvelope(input: unknown): FormDefinition {
  const schema = z.object({
    formatVersion: z.number().int().positive(),
    definition: z.unknown(),
    dependencies: z.record(z.string(), z.string()).optional()
  });

  const parsed = schema.parse(input);
  const definition = validateDefinition(parsed.definition);
  return {
    ...definition,
    dependencyVersions: parsed.dependencies ?? definition.dependencyVersions
  };
}

export function remapDefinitionStableIds(definition: FormDefinition): FormDefinition {
  const sectionIdMap = new Map<string, string>();
  const fieldIdMap = new Map<string, string>();
  const optionIdMap = new Map<string, string>();

  const sections = definition.sections.map((section, index) => {
    const nextId = `section_${index + 1}_${Date.now().toString(36)}`;
    sectionIdMap.set(section.id, nextId);
    return { ...section, id: nextId };
  });

  for (const [index, field] of definition.fields.entries()) {
    const nextFieldId = `field_${index + 1}_${Date.now().toString(36)}`;
    fieldIdMap.set(field.id, nextFieldId);
  }

  const fields = definition.fields.map((field) => {
    const nextFieldId = fieldIdMap.get(field.id) ?? field.id;

    const options = field.options?.map((option, optionIndex) => {
      const nextOptionId = `${nextFieldId}_opt_${optionIndex + 1}`;
      optionIdMap.set(option.id, nextOptionId);
      return { ...option, id: nextOptionId };
    });

    return {
      ...field,
      id: nextFieldId,
      key: nextFieldId,
      sectionId: sectionIdMap.get(field.sectionId) ?? field.sectionId,
      options,
      rules: field.rules.map((rule) => ({
        ...rule,
        sourceFieldId: fieldIdMap.get(rule.sourceFieldId) ?? rule.sourceFieldId,
        value: optionIdMap.get(String(rule.value ?? "")) ?? rule.value
      }))
    };
  });

  return {
    ...definition,
    sections,
    fields,
    metadata: {
      ...definition.metadata,
      formId: `imported_${Date.now().toString(36)}`
    }
  };
}

export function previewRecordMigration(
  sourceDefinition: FormDefinition | PublishedDefinition,
  targetDefinition: FormDefinition | PublishedDefinition,
  values: Record<string, unknown>
): {
  removedFieldIds: string[];
  missingRequiredFieldIds: string[];
  carriedFieldIds: string[];
} {
  const sourceIds = new Set(sourceDefinition.fields.map((field) => field.id));
  const targetIds = new Set(targetDefinition.fields.map((field) => field.id));

  const removedFieldIds = [...sourceIds].filter((id) => !targetIds.has(id));
  const carriedFieldIds = [...targetIds].filter((id) => sourceIds.has(id));
  const missingRequiredFieldIds = targetDefinition.fields
    .filter((field) => field.required && isMissingValue(values[field.id]))
    .map((field) => field.id);

  return {
    removedFieldIds,
    missingRequiredFieldIds,
    carriedFieldIds
  };
}

export function migrateRecordValuesToDefinition(
  targetDefinition: FormDefinition | PublishedDefinition,
  values: Record<string, unknown>
): Record<string, unknown> {
  const migrated: Record<string, unknown> = {};
  for (const field of targetDefinition.fields) {
    if (values[field.id] !== undefined) {
      migrated[field.id] = values[field.id];
      continue;
    }

    if (field.defaultValue !== undefined) {
      migrated[field.id] = field.defaultValue;
    }
  }
  return migrated;
}

function validateFieldType(type: FieldType, value: unknown, label: string, fieldId: string): ValidationError | null {
  const stringLike = ["text", "multiline", "date", "url", "single_select", "single_file"];
  if (stringLike.includes(type) && typeof value !== "string") {
    return { fieldId, code: "INVALID_TYPE", message: `${label} must be a string` };
  }

  if (type === "number" && typeof value !== "number") {
    return { fieldId, code: "INVALID_TYPE", message: `${label} must be a number` };
  }

  if (type === "checkbox" && typeof value !== "boolean") {
    return { fieldId, code: "INVALID_TYPE", message: `${label} must be true or false` };
  }

  if ((type === "multi_select" || type === "multi_file") && !Array.isArray(value)) {
    return { fieldId, code: "INVALID_TYPE", message: `${label} must be a list` };
  }

  return null;
}

function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}
