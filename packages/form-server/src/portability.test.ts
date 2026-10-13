import { describe, it, expect } from "vitest";
import { validateDefinition } from "@coderlifenet/form-core";
import { importDefinitionEnvelope, remapDefinitionStableIds } from "./definition-engine.js";
describe("portable imports",()=>{
 it("rejects unsupported envelopes and polluting input",()=>{
  expect(()=>importDefinitionEnvelope({formatVersion:2,definition:{}})).toThrow();
  expect(()=>importDefinitionEnvelope(JSON.parse('{"formatVersion":1,"definition":{},"constructor":{"prototype":{"x":1}}}'))).toThrow(/UNSAFE/);
 });
 it("remaps forward option references, defaults, source dependencies and tracking IDs in independent copies",()=>{
  const definition=validateDefinition({metadata:{formId:"original",name:"Original"},tracking:{id:"form-tracking",semanticId:"classification"},sections:[{id:"s",title:"S",order:0}],fields:[
   {id:"a",key:"a",type:"text",label:"A",sectionId:"s",row:0,width:6,tracking:{id:"a-tracking"},rules:[{id:"r",behavior:"visible",sourceFieldId:"b",operator:"equals",value:"option"}],source:{id:"value-source",version:"1",mode:"manual",dependsOn:["b"]}},
   {id:"b",key:"b",type:"single_select",label:"B",sectionId:"s",row:0,width:6,defaultValue:"option",options:[{id:"option",label:"Choice"}]}
  ]});
  const copy=remapDefinitionStableIds(definition);const other=remapDefinitionStableIds(definition);
  expect(copy.fields[0].rules[0].value).toBe(copy.fields[1].options![0].id);
  expect(copy.fields[1].defaultValue).toBe(copy.fields[1].options![0].id);
  expect(copy.fields[0].source?.dependsOn).toEqual([copy.fields[1].id]);
  expect(copy.tracking?.id).not.toBe(definition.tracking?.id);
  expect(copy.tracking?.semanticId).toBe("classification");
  expect(other.fields[0].id).not.toBe(copy.fields[0].id);
  expect(definition.fields[1].options![0].id).toBe("option");
 });
});
