import { nanoid } from "nanoid";
import { z } from "zod";
import { RE2JS } from "re2js";
import { supportedTrackingEvents } from "./ui-event-catalog.js";
export { supportedTrackingEvents } from "./ui-event-catalog.js";

export type FieldType =
  | "text"
  | "multiline"
  | "number"
  | "date"
  | "checkbox"
  | "single_select"
  | "radio"
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
  "radio",
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

// Serializable configuration only; no dependency on React or the UI runtime.
export const trackingSettingsSchema = z.object({
  id: z.string().min(1).max(128),
  semanticId: z.string().min(1).max(128).optional(),
  optOut: z.boolean().optional(),
  events: z.array(z.string().refine(event => supportedTrackingEvents.includes(event), "Unsupported tracking event")).max(128).optional(),
  metadata: z.record(z.string(), z.union([z.string().max(256), z.number().finite(), z.boolean(), z.null()])).optional()
}).strict();
export type TrackingSettings = z.infer<typeof trackingSettingsSchema>;
export const accessibilitySettingsSchema = z.object({
  label: z.string().max(512).optional(),
  description: z.string().max(2048).optional(),
  instructions: z.string().max(2048).optional()
}).strict();

export const fieldSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  type: fieldTypeSchema,
  label: z.string().min(1),
  tracking: trackingSettingsSchema.optional(),
  accessibility: accessibilitySettingsSchema.optional(),
  helpText: z.string().optional(),
  tooltipText: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  required: z.boolean().default(false),
  sectionId: z.string().min(1),
  row: z.number().int().nonnegative(),
  width: z.number().int().min(1).max(12),
  uploadPolicy: z.object({ maxBytes:z.number().int().positive().max(20971520).optional(), maxFiles:z.number().int().positive().max(100).optional(), mediaTypes:z.array(z.string().min(1)).optional() }).strict().optional(),
  options: z.array(optionSchema).optional(),
  rules: z.array(conditionRuleSchema).default([]),
  source: z
    .object({
      id: z.string().min(1),
      version: z.string().min(1),
      kind: z.enum(["value", "options"]).optional(),
      dependsOn: z.array(z.string()).optional(),
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
  tracking: trackingSettingsSchema.optional(),
  accessibility: accessibilitySettingsSchema.optional(),
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
  return matchesSafeRegex(pattern, input);
}

export function validateDefinition(definition: unknown): FormDefinition {
  assertSafeInput(definition);
  const parsed = formDefinitionSchema.parse(definition);

  const fieldIds = new Set(parsed.fields.map((field) => field.id));
  const sections = new Set(parsed.sections.map(section => section.id));
  if (fieldIds.size !== parsed.fields.length || sections.size !== parsed.sections.length) throw new Error("DUPLICATE_DEFINITION_IDS");
  const optionIds = parsed.fields.flatMap(field => (field.options ?? []).map(option => option.id));
  if (new Set(optionIds).size !== optionIds.length) throw new Error("DUPLICATE_OPTION_IDS");
  for (const field of parsed.fields) {
    if (!sections.has(field.sectionId)) throw new Error("UNKNOWN_SECTION");
    if (field.source?.dependsOn?.some(id => !fieldIds.has(id))) throw new Error("UNKNOWN_SOURCE_DEPENDENCY");
  }

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

// Bound input traversal before parsing; reject keys that could mutate prototypes.
export function assertSafeInput(value: unknown): void {
  let nodes = 0;
  const ancestors = new Set<object>();
  function visit(item: unknown, depth: number): void {
    if (++nodes > 50000 || depth > 32) throw new Error("INPUT_LIMIT_EXCEEDED");
    if (["function", "symbol", "bigint"].includes(typeof item)) throw new Error("UNSAFE_INPUT_KEY");
    if (!item || typeof item !== "object") return;
    if (ancestors.has(item)) throw new Error("CYCLIC_INPUT");
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) throw new Error("UNSAFE_PROTOTYPE");
    ancestors.add(item);
    for (const key of Object.keys(item)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("UNSAFE_INPUT_KEY");
      visit((item as Record<string, unknown>)[key], depth + 1);
    }
    ancestors.delete(item);
  }
  visit(value, 0);
}
export function parsePortableJson(json: string): unknown {
  if (new TextEncoder().encode(json).length > 1048576) throw new Error("IMPORT_TOO_LARGE");
  const value: unknown = JSON.parse(json);
  assertSafeInput(value);
  return value;
}

export function copyDefinition(definition: FormDefinition): FormDefinition {
  const sectionIds = new Map(definition.sections.map(s => [s.id, createStableId("section")]));
  const fieldIds = new Map(definition.fields.map(f => [f.id, createStableId("field")]));
  const optionIds = new Map(definition.fields.flatMap(f => (f.options ?? []).map(o => [o.id, createStableId("option")] as const)));
  const tracking = (settings: TrackingSettings | undefined) => settings ? { ...settings, id: createStableId("tracking") } : undefined;
  const optionValue = (value: unknown): unknown => Array.isArray(value) ? value.map(optionValue) : typeof value === "string" ? optionIds.get(value) ?? value : value;
  return {
    ...definition,
    metadata: { ...definition.metadata, formId: createStableId("imported") },
    tracking: tracking(definition.tracking),
    sections: definition.sections.map(s => ({ ...s, id: sectionIds.get(s.id)! })),
    fields: definition.fields.map(f => ({
      ...f, id: fieldIds.get(f.id)!, key: fieldIds.get(f.id)!, sectionId: sectionIds.get(f.sectionId)!,
      tracking: tracking(f.tracking),
      source: f.source ? { ...f.source, dependsOn: f.source.dependsOn?.map(id => fieldIds.get(id) ?? id) } : undefined,
      defaultValue: f.type === "single_select" || f.type === "radio" || f.type === "multi_select" ? optionValue(f.defaultValue) : f.defaultValue,
      options: f.options?.map(o => ({ ...o, id: optionIds.get(o.id)! })),
      rules: f.rules.map(r => ({ ...r, id: createStableId("rule"), sourceFieldId: fieldIds.get(r.sourceFieldId)!, value: optionValue(r.value) as typeof r.value }))
    }))
  };
}

export function matchesSafeRegex(pattern: string, input: string): boolean {
  return RE2JS.compile(pattern).matches(input);
}
