import { describe, expect, it } from "vitest";
import {
  compareDefinitions,
  evaluateRule,
  normalizeValue,
  validateDefinition
} from "./index.js";

describe("normalizeValue", () => {
  it("keeps missing/null/empty string separate", () => {
    expect(normalizeValue(undefined)).toEqual({ kind: "missing" });
    expect(normalizeValue(null)).toEqual({ kind: "null" });
    expect(normalizeValue("")).toEqual({ kind: "empty_string" });
  });

  it("keeps false and zero as values", () => {
    expect(normalizeValue(false)).toEqual({ kind: "boolean", value: false });
    expect(normalizeValue(0)).toEqual({ kind: "number", value: 0 });
  });
});

describe("validateDefinition", () => {
  it("rejects unknown rule source fields", () => {
    const bad = {
      metadata: { formId: "f1", name: "test" },
      sections: [{ id: "s1", title: "S", order: 0 }],
      fields: [
        {
          id: "a",
          key: "a",
          type: "text",
          label: "A",
          sectionId: "s1",
          row: 0,
          width: 6,
          rules: [
            {
              id: "r1",
              behavior: "visible",
              sourceFieldId: "missing",
              operator: "equals",
              value: "x"
            }
          ]
        }
      ]
    };

    expect(() => validateDefinition(bad)).toThrow(/unknown source field/i);
  });
});

describe("compareDefinitions", () => {
  it("reports added removed and renamed by stable id", () => {
    const oldDef = {
      metadata: { formId: "f1", name: "Old" },
      sections: [{ id: "s1", title: "S", order: 0 }],
      fields: [
        { id: "a", key: "a", type: "text", label: "Old A", sectionId: "s1", row: 0, width: 6 },
        { id: "b", key: "b", type: "text", label: "B", sectionId: "s1", row: 0, width: 6 }
      ],
      dependencyVersions: {}
    };
    const nextDef = {
      metadata: { formId: "f1", name: "New" },
      sections: [{ id: "s1", title: "S", order: 0 }],
      fields: [
        { id: "a", key: "a", type: "text", label: "New A", sectionId: "s1", row: 0, width: 6 },
        { id: "c", key: "c", type: "text", label: "C", sectionId: "s1", row: 0, width: 6 }
      ],
      dependencyVersions: {}
    };

    const diff = compareDefinitions(oldDef as any, nextDef as any);
    expect(diff.added).toEqual(["c"]);
    expect(diff.removed).toEqual(["b"]);
    expect(diff.renamed).toEqual([{ fieldId: "a", oldLabel: "Old A", newLabel: "New A" }]);
  });
});

describe("evaluateRule", () => {
  it("supports includes_option", () => {
    expect(evaluateRule(["x", "y"], "includes_option", "y")).toBe(true);
  });
});

describe("portable definition hardening and tracking", () => {
  const definition = {metadata:{formId:"form",name:"Form"}, sections:[{id:"section",title:"Details",order:0}],fields:[],tracking:{id:"tracking",events:[]}};
  it("preserves explicit empty event allowlists",()=>{expect(validateDefinition(definition).tracking?.events).toEqual([]);});
  it("rejects unsupported event names",()=>{expect(()=>validateDefinition({...definition,tracking:{id:"tracking",events:["made-up"]}})).toThrow();});
  it("rejects polluting keys and excessive nesting before normalization",()=>{
    expect(()=>validateDefinition(JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow(/UNSAFE/);
    let nested: any={}; for(let i=0;i<40;i++) nested={child:nested};
    expect(()=>validateDefinition(nested)).toThrow(/LIMIT/);
  });
});
