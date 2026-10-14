// @vitest-environment jsdom
import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { validateDefinition } from "@coderlifenet/form-core";
import { FormBuilder } from "./index.js";
afterEach(cleanup);
const definition=validateDefinition({metadata:{formId:"f",name:"F"},sections:[{id:"s",title:"S",order:0}],fields:[{id:"a",key:"a",type:"text",label:"A",sectionId:"s",row:0,width:6}]});
it("retains new edits made while a save is in flight and serializes the next save",async()=>{
 let complete!:()=>void;
 const save=vi.fn().mockImplementationOnce(()=>new Promise<void>(resolve=>{complete=resolve;})).mockResolvedValue(undefined);
 render(<FormBuilder initialDefinition={definition} onSaveDraft={save} onPublish={vi.fn()} autosaveDelay={10}/>);
 await userEvent.clear(screen.getByRole("textbox",{name:"Label"}));
 await userEvent.type(screen.getByRole("textbox",{name:"Label"}),"First");
 await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
 await userEvent.type(screen.getByRole("textbox",{name:"Label"})," second");
 complete();
 await waitFor(()=>expect(save.mock.calls.at(-1)?.[0].fields[0].label).toBe("First second"));
 expect(screen.getByRole("textbox",{name:"Label"}).getAttribute("value")).toBe("First second");
});
it("failed manual save preserves edits and does not navigate",async()=>{
 const done=vi.fn();const save=vi.fn().mockRejectedValue(new Error("Permission changed"));
 render(<FormBuilder initialDefinition={definition} onSaveDraft={save} onPublish={vi.fn()} onSaved={done} autosaveDelay={false}/>);
 await userEvent.type(screen.getByRole("textbox",{name:"Label"})," edited");
 await userEvent.click(screen.getByRole("button",{name:"Save draft"}));
 await waitFor(()=>expect(screen.getByRole("status").textContent).toContain("Permission changed"));
 expect(done).not.toHaveBeenCalled();expect(screen.getByRole("textbox",{name:"Label"}).getAttribute("value")).toBe("A edited");
});
it("uses a single-field custom drag image for layout reordering",()=>{
 const save=vi.fn();
 render(<FormBuilder initialDefinition={definition} onSaveDraft={save} onPublish={vi.fn()} autosaveDelay={false}/>);
 const layoutField=document.querySelector('section[aria-label="Form builder"] main button[draggable="true"]') as HTMLButtonElement | null;
 expect(layoutField).not.toBeNull();
 const setDragImage=vi.fn();
 const setData=vi.fn();
 fireEvent.dragStart(layoutField!,{dataTransfer:{setDragImage,setData,effectAllowed:"none"}} as any);
 expect(setDragImage).toHaveBeenCalledTimes(1);
 expect(setData).toHaveBeenCalledWith("application/x-coderlifenet-form-field","a");
 expect(setData).toHaveBeenCalledWith("text/plain","a");
 const dragGhost = setDragImage.mock.calls[0]?.[0] as HTMLElement;
 expect(dragGhost?.isConnected).toBe(true);
 fireEvent.dragEnd(layoutField!);
 expect(dragGhost?.isConnected).toBe(false);
});
