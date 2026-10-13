import { it, expect } from "vitest";
import { validateUploadBytes } from "./upload-policy.js";
it("rejects forged MIME signatures and enforces configured size/type limits",()=>{
 expect(()=>validateUploadBytes(Buffer.from("not png"),"image/png",{})).toThrow();
 expect(()=>validateUploadBytes(Buffer.from("text"),"text/plain",{maxBytes:3})).toThrow();
 expect(()=>validateUploadBytes(Buffer.from("text"),"text/plain",{mediaTypes:["application/pdf"]})).toThrow();
 expect(()=>validateUploadBytes(Buffer.from("%PDF-1.7"),"application/pdf",{mediaTypes:["application/pdf"]})).not.toThrow();
});
