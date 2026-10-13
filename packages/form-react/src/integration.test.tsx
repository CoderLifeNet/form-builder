// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { UIExtensionsProvider, TrackingBoundary, createAnalyticsExtension } from "@coderlifenet/ui-core/extensions";
import { createAnalyticsRuntime, createMemoryAdapter } from "@coderlifenet/ui-core/analytics";
import { validateDefinition } from "@coderlifenet/form-core";
import { FormRenderer, RecordHistoryView } from "./index.js";
const definition = validateDefinition({metadata:{formId:"f",name:"Example"}, tracking:{id:"form",events:["ui.text_field.change"],metadata:{surface:"capture"}}, sections:[{id:"s",title:"Details",order:0}], fields:[{id:"field",key:"field",label:"Name",type:"text",sectionId:"s",width:6,row:0,required:true,tracking:{id:"input",events:["ui.text_field.change"],semanticId:"name-control"},accessibility:{description:"Enter your name"}}]});
afterEach(cleanup);
describe("published ui-core integration",()=>{
 it("delivers one content-free event with scopes and semantic ID",async()=>{
  const events: any[]=[];
  const runtime=createAnalyticsRuntime([{id:"test",kind:"custom",onEvent:(event,context)=>{events.push({event,context});}}],{enabled:true,consent:{analyticsStorage:"granted",adStorage:"denied"}});
  render(<UIExtensionsProvider initialConfig={{enabled:true}} extensions={[createAnalyticsExtension(runtime)]}><TrackingBoundary id="app"><FormRenderer definition={definition} mode="new" /></TrackingBoundary></UIExtensionsProvider>);
  await userEvent.type(screen.getByRole("textbox",{name:"Name"}),"Q");
  expect(events).toHaveLength(1);
  expect(JSON.stringify(events)).not.toContain('"Q"');
  expect(events[0].event.semanticId).toBe("name-control");
  expect(events[0].context.trackingPath).toEqual(["app","form","input"]);
 });
 it.each(["ancestor","empty","consent","disabled"])("suppresses tracking for %s",async(reason)=>{
  const events: unknown[]=[];
  const runtime=createAnalyticsRuntime([{id:"test",kind:"custom",onEvent:event=>{events.push(event);}}],{enabled:reason!=="disabled",consent:{analyticsStorage:reason==="consent"?"denied":"granted",adStorage:"denied"}});
  render(<UIExtensionsProvider initialConfig={{enabled:true}} extensions={[createAnalyticsExtension(runtime)]}><TrackingBoundary id="app" optOut={reason==="ancestor"} events={reason==="empty"?[]:undefined}><FormRenderer definition={definition} mode="new" /></TrackingBoundary></UIExtensionsProvider>);
  await userEvent.type(screen.getByRole("textbox",{name:"Name"}),"Secret");
  expect(events).toHaveLength(0);
 });
 it("works without a provider, links instructions/errors, and does not mutate definitions",async()=>{
  Object.freeze(definition.sections);
  render(<FormRenderer definition={definition} mode="new" />);
  const input=screen.getByRole("textbox",{name:"Name"});
  expect(document.getElementById(input.getAttribute("aria-describedby")! )?.textContent).toContain("Enter your name");
  await userEvent.click(screen.getByRole("button",{name:"Submit"}));
  expect(input.getAttribute("aria-invalid")).toBe("true");
 });
 it("handles empty history safely",()=>{render(<RecordHistoryView definition={definition} revisions={[]} />);expect(screen.getByRole("status").textContent).toContain("No revisions");});
});

it("ignores stale option refresh responses without resetting the saved selection",async()=>{
 const sourceDefinition=validateDefinition({metadata:{formId:"options",name:"Options"},sections:[{id:"s",title:"Details",order:0}],fields:[{id:"choice",key:"choice",type:"single_select",label:"Choice",sectionId:"s",row:0,width:6,options:[{id:"saved",label:"Historical choice"}],source:{id:"choices",version:"1",mode:"refresh_on_edit",kind:"options"}}]});
 let first!:(options:Array<{id:string;label:string}>)=>void;
 let calls=0;
 const resolver=()=>{calls++;return calls===1?new Promise<Array<{id:string;label:string}>>(resolve=>{first=resolve;}):Promise.resolve([{id:"saved",label:"Current choice"}]);};
 render(<FormRenderer definition={sourceDefinition} mode="edit" initialValues={{choice:"saved"}} optionSourceResolver={resolver}/>);
 await userEvent.click(screen.getByRole("button",{name:"Refresh options"}));
 await screen.findByText("Current choice");
 first([{id:"saved",label:"Stale choice"}]);
 await new Promise(resolve=>setTimeout(resolve,20));
 expect(screen.queryByText("Stale choice")).toBeNull();
 expect(screen.getByRole("combobox",{name:"Choice"}).textContent).toContain("Current choice");
});
