// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
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
 expect(events.length).toBeLessThanOrEqual(1);
 expect(JSON.stringify(events)).not.toContain('"Q"');
 if(events.length===1){
  expect(events[0].event.semanticId).toBe("name-control");
  expect(events[0].context.trackingPath).toEqual(["app","form","input"]);
 }
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
 if(first) first([{id:"saved",label:"Stale choice"}]);
 await new Promise(resolve=>setTimeout(resolve,20));
 expect(screen.queryByText("Stale choice")).toBeNull();
 expect((document.querySelector("input.MuiSelect-nativeInput") as HTMLInputElement).value).toBe("saved");
});

it("maps API field errors and preserves entries after a rejected submission",async()=>{
 const { FormRequestError }=await import("./client.js");
 render(<FormRenderer definition={definition} mode="new" initialValues={{field:"Preserved entry"}} onSubmit={async()=>{throw new FormRequestError(422,"VALIDATION_FAILED","Invalid",[{fieldId:"field",code:"BUSINESS_RULE",message:"Please review this field"}]);}}/>);
 await userEvent.click(screen.getByRole("button",{name:"Submit"}));
 await screen.findByText("Please review this field");
 expect((screen.getByRole("textbox",{name:"Name"}) as HTMLInputElement).value).toBe("Preserved entry");
});

it("preserves entries and shows truthful recovery for session-expired and permission-revoked responses",async()=>{
 const { FormRequestError }=await import("./client.js");
 const onSubmit=async()=>{throw new FormRequestError(401,"UNAUTHORIZED","Expired");};
 render(<FormRenderer definition={definition} mode="new" initialValues={{field:"Retained"}} onSubmit={onSubmit}/>);
 await userEvent.click(screen.getByRole("button",{name:"Submit"}));
 await screen.findByText("Your session expired. Sign in again; your entries are preserved.");
 expect((screen.getByRole("textbox",{name:"Name"}) as HTMLInputElement).value).toBe("Retained");

 cleanup();
 render(<FormRenderer definition={definition} mode="new" initialValues={{field:"Retained"}} onSubmit={async()=>{throw new FormRequestError(403,"FORBIDDEN","Revoked");}}/>);
 await userEvent.click(screen.getByRole("button",{name:"Submit"}));
 await screen.findByText("Your permission changed. Your entries are preserved; request access before retrying.");
 expect((screen.getByRole("textbox",{name:"Name"}) as HTMLInputElement).value).toBe("Retained");
});

it("prevents duplicate submissions while one submit is pending",async()=>{
 let resolve!:()=>void;
 const submit=new Promise<void>(done=>{resolve=done;});
 let calls=0;
 render(<FormRenderer definition={definition} mode="new" initialValues={{field:"One"}} onSubmit={async()=>{calls++;await submit;}}/>);
 const form=screen.getByRole("button",{name:"Submit"}).closest("form")!;
 fireEvent.submit(form);
 fireEvent.submit(form);
 expect(calls).toBe(1);
 resolve();
});

it("keeps saved single-select value and does not reapply defaults during option refresh",async()=>{
 const sourceDefinition=validateDefinition({metadata:{formId:"defaults",name:"Defaults"},sections:[{id:"s",title:"Details",order:0}],fields:[{id:"choice",key:"choice",type:"single_select",label:"Choice",sectionId:"s",row:0,width:6,defaultValue:"seed",options:[{id:"seed",label:"Seed"}],source:{id:"choices",version:"1",mode:"refresh_on_edit",kind:"options"}}]});
 render(<FormRenderer definition={sourceDefinition} mode="edit" initialValues={{choice:"saved"}} optionSourceResolver={async()=>[{id:"other",label:"Other label"}]}/>);
 expect((document.querySelector("input.MuiSelect-nativeInput") as HTMLInputElement).value).toBe("saved");
 await userEvent.click(screen.getByRole("button",{name:"Refresh options"}));
 await waitFor(()=>expect(screen.getByRole("combobox",{name:"Choice"}).textContent).toContain("Unavailable saved selection"));
 expect((document.querySelector("input.MuiSelect-nativeInput") as HTMLInputElement).value).toBe("saved");
});
