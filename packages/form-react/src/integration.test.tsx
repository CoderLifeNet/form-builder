// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { UIExtensionsProvider, TrackingBoundary, createAnalyticsExtension } from "@coderlifenet/ui-core/extensions";
import { createAnalyticsRuntime, createMemoryAdapter } from "@coderlifenet/ui-core/analytics";
import { validateDefinition } from "@coderlifenet/form-core";
import { FormRenderer, RecordHistoryView } from "./index.js";
const definition = validateDefinition({metadata:{formId:"f",name:"Example"}, tracking:{id:"form",events:["ui.text_field.change"],metadata:{surface:"capture"}}, sections:[{id:"s",title:"Details",order:0}], fields:[{id:"field",key:"field",label:"Name",type:"text",sectionId:"s",width:6,row:0,required:true,tracking:{id:"input",events:["ui.text_field.change"],semanticId:"name-control"},accessibility:{description:"Enter your name"}}]});
beforeEach(() => {
   vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/dev/login") && init?.method === "POST") {
         return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/api/forms") && init?.method === "POST") {
         return new Response(JSON.stringify({ formId: "f_example", draftRevision: 1 }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
   }));
});
function deferred<T>() {
 let resolve!: (value: T) => void;
 let reject!: (reason?: unknown) => void;
 const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
 });
 return { promise, resolve, reject };
}
afterEach(cleanup);
afterEach(() => {
   vi.restoreAllMocks();
});
describe("published ui-core integration",()=>{
 it("delivers one content-free event with scopes and semantic ID",async()=>{
  const events: any[]=[];
  const runtime=createAnalyticsRuntime([{id:"test",kind:"custom",onEvent:(event,context)=>{events.push({event,context});}}],{enabled:true,consent:{analyticsStorage:"granted",adStorage:"denied"}});
  render(<UIExtensionsProvider initialConfig={{enabled:true}} extensions={[createAnalyticsExtension(runtime)]}><TrackingBoundary id="app"><FormRenderer definition={definition} mode="new" /></TrackingBoundary></UIExtensionsProvider>);
  await userEvent.type(screen.getByRole("textbox",{name:"Name"}),"Q");
    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    const tracked = events.find(entry => entry.event?.type === "ui.text_field.change");
    expect(tracked).toBeDefined();
    expect(tracked.event.semanticId).toBe("name-control");
    expect(tracked.context.trackingPath).toEqual(["app","form","input"]);
    expect(JSON.stringify(tracked)).not.toContain('"Q"');
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
 const first = deferred<Array<{id:string;label:string}>>();
 const second = deferred<Array<{id:string;label:string}>>();
 let calls=0;
 const resolver=()=>{
  calls++;
  if(calls===1) return first.promise;
  if(calls===2) return second.promise;
  return Promise.resolve([{id:"saved",label:"Current choice"}]);
 };
 render(<FormRenderer definition={sourceDefinition} mode="edit" initialValues={{choice:"saved"}} optionSourceResolver={resolver}/>);
 await waitFor(()=>expect(calls).toBe(1));
 await userEvent.click(screen.getByRole("button",{name:"Refresh options"}));
 await waitFor(()=>expect(calls).toBe(2));
 second.resolve([{id:"saved",label:"Current choice"}]);
 await waitFor(()=>expect(screen.getByRole("combobox",{name:"Choice"}).textContent).toContain("Current choice"));
 first.resolve([{id:"saved",label:"Stale choice"}]);
 await waitFor(()=>expect(screen.getByRole("combobox",{name:"Choice"}).textContent).toContain("Current choice"));
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

it("supports radio-button single-choice input selection", async () => {
 const radioDefinition = validateDefinition({
   metadata: { formId: "radio", name: "Radio" },
   sections: [{ id: "s", title: "Details", order: 0 }],
   fields: [{
      id: "priority",
      key: "priority",
      type: "radio",
      label: "Priority",
      sectionId: "s",
      row: 0,
      width: 12,
      required: true,
      options: [
         { id: "low", label: "Low" },
         { id: "normal", label: "Normal" },
         { id: "high", label: "High" }
      ]
   }]
 });

 render(<FormRenderer definition={radioDefinition} mode="new" initialValues={{ priority: "normal" }} />);
 const normal = screen.getByRole("radio", { name: "Normal" });
 expect((normal as HTMLInputElement).checked).toBe(true);
 expect((normal as HTMLInputElement).name.length).toBeGreaterThan(0);
 await userEvent.click(screen.getByRole("radio", { name: "Low" }));
 expect((screen.getByRole("radio", { name: "Low" }) as HTMLInputElement).checked).toBe(true);
});

it("prevents in-flight source results from a previous form from leaking after cross-form switch",async()=>{
 const firstDefinition = validateDefinition({
  metadata: { formId: "form_one", name: "Form One" },
  sections: [{ id: "s1", title: "Section", order: 0 }],
  fields: [{ id: "f1", key: "f1", type: "text", label: "Field One", sectionId: "s1", row: 0, width: 12, source: { id: "source_one", version: "1", mode: "display_only", kind: "value" } }]
 });
 const secondDefinition = validateDefinition({
  metadata: { formId: "form_two", name: "Form Two" },
  sections: [{ id: "s2", title: "Section", order: 0 }],
  fields: [{ id: "f2", key: "f2", type: "text", label: "Field Two", sectionId: "s2", row: 0, width: 12, source: { id: "source_two", version: "1", mode: "display_only", kind: "value" } }]
 });

 let resolveFirst!: (value: unknown) => void;
 const resolver = vi.fn(async (sourceId: string) => {
  if (sourceId === "source_one") {
   return await new Promise((resolve) => {
    resolveFirst = resolve;
   });
  }
  return "second-value";
 });

 const rendered = render(<FormRenderer definition={firstDefinition} mode="new" sourceResolver={resolver} />);
 await waitFor(() => expect(resolver).toHaveBeenCalledWith("source_one", expect.any(Object), expect.any(AbortSignal)));

 rendered.rerender(<FormRenderer definition={secondDefinition} mode="new" sourceResolver={resolver} />);
 await waitFor(() => expect((screen.getByRole("textbox", { name: "Field Two" }) as HTMLInputElement).value).toBe("second-value"));

 resolveFirst("first-value");
 await waitFor(() => expect((screen.getByRole("textbox", { name: "Field Two" }) as HTMLInputElement).value).toBe("second-value"));
});

it("invalidates in-flight requests when switching identities with identical form/source config", async () => {
 const sharedFields = [{ id: "field", key: "field", type: "text", label: "Name", sectionId: "s", row: 0, width: 12, source: { id: "profile.name", version: "1", mode: "display_only", kind: "value" as const } }];
 const base = { metadata: { formId: "same", name: "Same" }, sections: [{ id: "s", title: "S", order: 0 }], fields: sharedFields };
 const firstDefinition = validateDefinition(base);
 const secondDefinition = validateDefinition(base);
 const first = deferred<unknown>();
 let calls = 0;
 const resolver = vi.fn(async () => {
  calls += 1;
  if (calls === 1) return await first.promise;
  return "second";
 });

 const rendered = render(<FormRenderer definition={firstDefinition} mode="new" sourceResolver={resolver} renderIdentity="tenantA:formA:record1" />);
 await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
 rendered.rerender(<FormRenderer definition={secondDefinition} mode="new" sourceResolver={resolver} renderIdentity="tenantB:formB:record1" />);
 await waitFor(() => expect((screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("second"));

 first.resolve("first");
 await waitFor(() => expect((screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("second"));
});

it("resets to new record state for same form identity switches and ignores old async completions", async () => {
 const sameForm = validateDefinition({
  metadata: { formId: "form_shared", name: "Shared" },
  sections: [{ id: "s", title: "Section", order: 0 }],
  fields: [{ id: "title", key: "title", type: "text", label: "Title", sectionId: "s", row: 0, width: 12, source: { id: "title_source", version: "1", mode: "display_only", kind: "value" } }]
 });
 const oldDeferred = deferred<unknown>();
 let sourceCalls = 0;
 const resolver = vi.fn(async () => {
  sourceCalls += 1;
  if (sourceCalls === 1) return await oldDeferred.promise;
  return "record-two-source";
 });

 const rendered = render(<FormRenderer definition={sameForm} mode="edit" initialValues={{ title: "record-one" }} sourceResolver={resolver} renderIdentity="form_shared:record_1" />);
 await waitFor(() => expect((screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe("record-one"));

 rendered.rerender(<FormRenderer definition={sameForm} mode="edit" initialValues={{ title: "record-two" }} sourceResolver={resolver} renderIdentity="form_shared:record_2" />);
 await waitFor(() => expect((screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe("record-two-source"));

 oldDeferred.resolve("old-source-value");
 await waitFor(() => expect((screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe("record-two-source"));
});

it("preserves edits across rerenders of the same render identity", async () => {
 const sameDefinition = validateDefinition({
  metadata: { formId: "preserve", name: "Preserve" },
  sections: [{ id: "s", title: "Section", order: 0 }],
  fields: [{ id: "title", key: "title", type: "text", label: "Title", sectionId: "s", row: 0, width: 12 }]
 });
 const rendered = render(<FormRenderer definition={sameDefinition} mode="edit" initialValues={{ title: "seed" }} renderIdentity="preserve:record_1" />);
 const input = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
 await userEvent.clear(input);
 await userEvent.type(input, "local-edit");

 rendered.rerender(<FormRenderer definition={sameDefinition} mode="edit" initialValues={{ title: "server-refresh" }} renderIdentity="preserve:record_1" />);
 await waitFor(() => expect((screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe("local-edit"));
});

it("drops pending submission side effects when identity changes before delayed source resolution completes", async () => {
 const sourceDefinition = validateDefinition({
  metadata: { formId: "submit_form", name: "Submit Form" },
  sections: [{ id: "s", title: "Section", order: 0 }],
  fields: [{ id: "title", key: "title", type: "text", label: "Title", sectionId: "s", row: 0, width: 12, required: true, source: { id: "title_source", version: "1", mode: "display_only", kind: "value" } }]
 });
 const delayed = deferred<unknown>();
 const sourceResolver = vi.fn(async () => await delayed.promise);
 const oldSubmit = vi.fn(async () => { throw new Error("stale submit must not run"); });
 const newSubmit = vi.fn(async () => undefined);

 const rendered = render(<FormRenderer definition={sourceDefinition} mode="edit" initialValues={{ title: "one" }} sourceResolver={sourceResolver} onSubmit={oldSubmit} renderIdentity="submit_form:record_1" />);
 const oldForm = screen.getByRole("button", { name: "Submit" }).closest("form")!;
 fireEvent.submit(oldForm);

 rendered.rerender(<FormRenderer definition={sourceDefinition} mode="edit" initialValues={{ title: "two" }} sourceResolver={async () => "new-source"} onSubmit={newSubmit} renderIdentity="submit_form:record_2" />);
 delayed.resolve("old-source");
 await waitFor(() => expect((screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe("two"));
 expect(oldSubmit).toHaveBeenCalledTimes(0);
 expect(screen.queryByText("Submission failed. Your entries are preserved.")).toBeNull();
 expect((screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement).disabled).toBe(false);
});

