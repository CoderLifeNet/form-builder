import { nanoid } from "nanoid";
import { z } from "zod";

export type FieldType =
  | "text"
  | "multiline"
  | "number"
  | "date"
  | "checkbox"
  | "single_select"
  | "multi_select"
  | "url"
  | "single_file"
  | "multi_file";

export const fieldTypeSchema = z.enum([
  "text",
  "multiline",
  "number",
  "date",
  "checkbox",
  "single_select",
  "multi_select",
  "url",
  "single_file",
  "multi_file"
]);

export const operatorSchema = z.enum([
  "equals",
  "not_equals",
  "empty",
  "not_empty",
  "includes_option"
]);

export const behaviorSchema = z.enum([
  "visible",
  "required",
  "readonly",
  "disabled"
]);

export const conditionRuleSchema = z.object({
  id: z.string().min(1),
  behavior: behaviorSchema,
  sourceFieldId: z.string().min(1),
  operator: operatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional()
});

export const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
});

export const fieldSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  type: fieldTypeSchema,
  label: z.string().min(1),
  helpText: z.string().optional(),
  tooltipText: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  required: z.boolean().default(false),
  sectionId: z.string().min(1),
  row: z.number().int().nonnegative(),
  width: z.number().int().min(1).max(12),
  options: z.array(optionSchema).optional(),
  rules: z.array(conditionRuleSchema).default([]),
  source: z
    .object({
      id: z.string().min(1),
      version: z.string().min(1),
      mode: z.enum(["manual", "create_only", "refresh_on_edit", "display_only"]) 
    })
    .optional(),
  validation: z
    .object({
      minLength: z.number().int().nonnegative().optional(),
      maxLength: z.number().int().positive().optional(),
      minNumber: z.number().optional(),
      maxNumber: z.number().optional(),
      regex: z.string().optional(),
      regexMessage: z.string().optional()
    })
    .optional()
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative()
});

export const definitionMetadataSchema = z.object({
  formId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  schemaVersion: z.string().default("1.0.0")
});

export const formDefinitionSchema = z.object({
  metadata: definitionMetadataSchema,
  sections: z.array(sectionSchema),
  fields: z.array(fieldSchema),
  dependencyVersions: z.record(z.string(), z.string()).default({})
});

export const publishedDefinitionSchema = formDefinitionSchema.extend({
  publicationVersion: z.number().int().positive(),
  publishedAt: z.string().datetime()
});

export type FormDefinition = z.infer<typeof formDefinitionSchema>;
export type PublishedDefinition = z.infer<typeof publishedDefinitionSchema>;

export type ValidationError = {
  fieldId: string;
  code: string;
  message: string;
};

export type NormalizedValue =
  | { kind: "missing" }
  | { kind: "null" }
  | { kind: "empty_string" }
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "string_list"; value: string[] };

export function createStableId(prefix: string): string {
  return `${prefix}_${nanoid(12)}`;
}

export function normalizeValue(value: unknown): NormalizedValue {
  if (value === undefined) {
    return { kind: "missing" };
  }
  if (value === null) {
    return { kind: "null" };
  }
  if (typeof value === "boolean") {
    return { kind: "boolean", value };
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? { kind: "number", value } : { kind: "string", value: String(value) };
  }
  if (typeof value === "string") {
    if (value.length === 0) {
      return { kind: "empty_string" };
    }
    return { kind: "string", value };
  }
  if (Array.isArray(value)) {
    return { kind: "string_list", value: value.map((v) => String(v)) };
  }
  return { kind: "string", value: JSON.stringify(value) };
}

export async function testSafeRegex(pattern: string, input: string): Promise<boolean> {
  const { RE2JS } = await import("re2js");
  const re2 = RE2JS.compile(pattern);
  return re2.matches(input);
}

export function validateDefinition(definition: unknown): FormDefinition {
  const parsed = formDefinitionSchema.parse(definition);

  const fieldIds = new Set(parsed.fields.map((field) => field.id));
  for (const field of parsed.fields) {
    for (const rule of field.rules) {
      if (!fieldIds.has(rule.sourceFieldId)) {
        throw new Error(`Field ${field.id} references unknown source field ${rule.sourceFieldId}`);
      }
    }
  }

  return parsed;
}

export function compareDefinitions(oldDef: FormDefinition, newDef: FormDefinition): {
  added: string[];
  removed: string[];
  renamed: Array<{ fieldId: string; oldLabel: string; newLabel: string }>;
} {
  const oldById = new Map(oldDef.fields.map((field) => [field.id, field]));
  const newById = new Map(newDef.fields.map((field) => [field.id, field]));

  const added: string[] = [];
  const removed: string[] = [];
  const renamed: Array<{ fieldId: string; oldLabel: string; newLabel: string }> = [];

  for (const field of newDef.fields) {
    if (!oldById.has(field.id)) {
      added.push(field.id);
      continue;
    }
    const previous = oldById.get(field.id);
    if (previous && previous.label !== field.label) {
      renamed.push({ fieldId: field.id, oldLabel: previous.label, newLabel: field.label });
    }
  }

  for (const field of oldDef.fields) {
    if (!newById.has(field.id)) {
      removed.push(field.id);
    }
  }

  return { added, removed, renamed };
}

export function evaluateRule(
  sourceValue: unknown,
  operator: z.infer<typeof operatorSchema>,
  ruleValue?: string | number | boolean
): boolean {
  switch (operator) {
    case "equals":
      return sourceValue === ruleValue;
    case "not_equals":
      return sourceValue !== ruleValue;
    case "empty":
      return sourceValue === undefined || sourceValue === null || sourceValue === "";
    case "not_empty":
      return !(sourceValue === undefined || sourceValue === null || sourceValue === "");
    case "includes_option":
      return Array.isArray(sourceValue) ? sourceValue.includes(ruleValue) : false;
    default:
      return false;
  }
}
