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
