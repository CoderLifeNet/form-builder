import { it, expect, vi } from "vitest";
import { createFormApiClient, createMutationRetryKey, FormRequestError } from "./client.js";
it("preserves server field errors and HTTP status for renderer recovery",async()=>{
 const errors=[{fieldId:"name",code:"REQUIRED",message:"Name is required"}];
 const request=createFormApiClient({baseUrl:"/forms",fetch:vi.fn().mockResolvedValue(new Response(JSON.stringify({code:"VALIDATION_FAILED",message:"Invalid",fieldErrors:errors}),{status:422}))});
 await expect(request("/api/records")).rejects.toMatchObject({status:422,code:"VALIDATION_FAILED",fieldErrors:errors});
});
it("handles Headers objects and no-content responses",async()=>{
 const transport=vi.fn().mockResolvedValue(new Response(null,{status:204}));
 const request=createFormApiClient({baseUrl:"/forms/",fetch:transport,headers:{"x-csrf-token":"test"}});
 expect(await request("/api/forms",{method:"DELETE",headers:new Headers({"x-example":"value"})})).toBeUndefined();
 expect(transport.mock.calls[0][0]).toBe("/forms/api/forms");
 expect(transport.mock.calls[0][1].headers.get("x-example")).toBe("value");
 expect(transport.mock.calls[0][1].headers.get("x-csrf-token")).toBe("test");
});
it("retains retry identity until the payload changes or commit is acknowledged",()=>{
 const keys=createMutationRetryKey();const first=keys.keyFor("same");
 expect(keys.keyFor("same")).toBe(first);
 expect(keys.keyFor("changed")).not.toBe(first);
 const committed=keys.keyFor("changed");keys.committed();expect(keys.keyFor("changed")).not.toBe(committed);
});
