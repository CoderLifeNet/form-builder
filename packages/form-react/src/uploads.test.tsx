// @vitest-environment jsdom
import React from "react";
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { FileField } from "./uploads.js";
afterEach(cleanup);
it("keeps every completed upload when selecting multiple files",async()=>{
 let saved: unknown;
 render(<FileField id="files" label="Attachments" multiple disabled={false} required={false} value={[]} upload={async(_id,file)=>file.name==="a.txt"?"upload-a":"upload-b"} onChange={value=>{saved=value;}} />);
 await userEvent.upload(screen.getByLabelText("Attachments"),[new File(["a"],"a.txt",{type:"text/plain"}),new File(["b"],"b.txt",{type:"text/plain"})]);
 expect(saved).toEqual(["upload-a","upload-b"]);
});

it("supports retry after a failed upload and preserves successful completion",async()=>{
 let attempt = 0;
 let saved: unknown;
 render(<FileField id="files" label="Attachments" multiple={false} disabled={false} required={false} value={undefined} upload={async()=>{attempt++;if(attempt===1)throw new Error("fail");return "upload-1";}} onChange={value=>{saved=value;}} />);
 await userEvent.upload(screen.getByLabelText("Attachments"),new File(["a"],"a.txt",{type:"text/plain"}));
 await screen.findByRole("alert");
 await userEvent.click(screen.getByRole("button",{name:"Retry upload"}));
 expect(saved).toBe("upload-1");
});

it("cancels an in-flight upload without committing selection",async()=>{
 let release!:()=>void;
 let saved: unknown;
 render(<FileField id="files" label="Attachments" multiple={false} disabled={false} required={false} value={undefined} upload={(_id,_file,signal)=>new Promise<string>((resolve,reject)=>{signal.addEventListener("abort",()=>reject(new Error("aborted")));release=()=>resolve("upload-late");})} onChange={value=>{saved=value;}} />);
 await userEvent.upload(screen.getByLabelText("Attachments"),new File(["a"],"a.txt",{type:"text/plain"}));
 await userEvent.click(screen.getByRole("button",{name:"Cancel upload"}));
 release();
 expect(saved).toBeUndefined();
 expect(screen.queryByText("Attached file 1")).toBeNull();
});
