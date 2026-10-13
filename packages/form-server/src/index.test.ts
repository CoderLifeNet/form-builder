import request from "supertest";
import { describe, expect, it } from "vitest";
import { createFormServer, PolicyAdapter } from "./index.js";

const definition = {
  metadata: { formId: "f", name: "Form", schemaVersion: "1.0.0" },
  sections: [{ id: "s", title: "Section", order: 0 }],
  fields: [
    {
      id: "field_title",
      key: "title",
      type: "text",
      label: "Title",
      required: true,
      sectionId: "s",
      row: 0,
      width: 12,
      rules: []
    }
  ],
  dependencyVersions: {}
};

function makeRepositoryStub() {
  const definition = {
    metadata: { formId: "f1", name: "Form", schemaVersion: "1.0.0" },
    publicationVersion: 1,
    publishedAt: new Date().toISOString(),
    sections: [{ id: "s", title: "Section", order: 0 }],
    fields: [
      {
        id: "field_title",
        key: "title",
        type: "text",
        label: "Request title",
        required: true,
        sectionId: "s",
        row: 0,
        width: 12,
        rules: [],
        validation: { minLength: 4 }
      }
    ],
    dependencyVersions: {}
  };

  return {
    createForm: async () => ({ formId: "f1", draftRevision: 1 }),
    getDraft: async () => ({ revision: 1, definition }),
    saveDraft: async () => ({ revision: 2 }),
    publishDraft: async () => ({ definitionId: "d1", publicationVersion: 1 }),
    getPublishedDefinitionById: async () => ({ id: "d1", formId: "f1", publicationVersion: 1, definition }),
    createUpload: async () => ({ id: "up_db_1", uploadId: "upload_1" }),
    getUploadById: async () => ({
      id: "up_db_1",
      uploadId: "upload_1",
      fileName: "demo.txt",
      contentType: "text/plain",
      sizeBytes: 5,
      objectKey: "tenant_demo/upload_1-a1b2"
    }),
    markUploadDeletionPending: async () => undefined,
    deleteUploadRow: async () => undefined,
    withIdempotency: async (_ctx: any, _op: string, _key: string, _payload: unknown, handler: any) => handler(),
    createRecordRevision: async () => ({ recordId: "r1", revisionId: "rev1", revisionNumber: 1 }),
    listPublishedDefinitionsByForm: async () => [{ id: "d1", formId: "f1", publicationVersion: 1, publishedAt: new Date().toISOString(), fieldCount: 1, name: "Form" }],
    getPublishedDefinitionByVersion: async () => ({ id: "d1", formId: "f1", publicationVersion: 1, definition }),
    listRecordSummaries: async () => [],
    getRecordSummaryById: async () => ({ recordId: "r1", formId: "f1", formName: "Form", createdBy: "owner1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev1", currentRevisionNumber: 1, currentDefinitionId: "d1" })
  };
}

function allowCapabilities(capabilities: string[]): PolicyAdapter {
  return {
    resolveContext: async () => ({ tenantId: "tenant_demo", actorId: "owner1", isAnonymous: false }),
    authorize: async (_ctx, capability) => ({
      allowed: capabilities.includes(capability),
      capabilities: [...capabilities]
    })
  };
}

describe("form server", () => {
  it("blocks anonymous design access", async () => {
    const app = createFormServer({ repository: makeRepositoryStub() as any });
    const response = await request(app).post("/api/forms").send({
      name: "x",
      definition
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  it("requires idempotency key on submit", async () => {
    const app = createFormServer({
      repository: makeRepositoryStub() as any,
      policyAdapter: allowCapabilities(["forms.submit"])
    });
    const response = await request(app)
      .post("/api/records")
      .send({ formId: "f1", definitionId: "d1", values: { title: "hello" } });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("IDEMPOTENCY_REQUIRED");
  });

  it("returns field validation errors", async () => {
    const app = createFormServer({
      repository: makeRepositoryStub() as any,
      policyAdapter: allowCapabilities(["forms.submit"])
    });
    const response = await request(app)
      .post("/api/records")
      .set("idempotency-key", "k1")
      .send({ formId: "f1", definitionId: "d1", values: { field_title: "x" } });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe("VALIDATION_FAILED");
    expect(response.body.fieldErrors[0].fieldId).toBe("field_title");
  });

  it("requires expectedRevision when editing an existing record", async () => {
    const app = createFormServer({
      repository: makeRepositoryStub() as any,
      policyAdapter: allowCapabilities(["forms.submit", "forms.edit"])
    });
    const response = await request(app)
      .post("/api/records")
      .set("idempotency-key", "k1")
      .send({ formId: "f1", definitionId: "d1", recordId: "r1", values: { field_title: "hello" } });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("EXPECTED_REVISION_REQUIRED");
  });

  it("stores upload through adapter", async () => {
    const app = createFormServer({
      repository: makeRepositoryStub() as any,
      policyAdapter: allowCapabilities(["forms.upload"]),
      uploadStorage: {
        storeObject: async () => ({ objectKey: "tenant_demo/upload_1", sizeBytes: 5 }),
        getObject: async () => {
          throw new Error("unused");
        },
        deleteObject: async () => undefined
      }
    });

    const response = await request(app)
      .post("/api/forms/f1/uploads")
      .set("content-type", "application/octet-stream")
      .set("x-file-name", "demo.txt")
      .send(Buffer.from("hello"));

    expect(response.status).toBe(201);
    expect(response.body.uploadId).toBe("upload_1");
    expect(response.body.sizeBytes).toBe(5);
  });

  it("exposes binding save/resolve/reset with optimistic revision checks", async () => {
    let revision = 0;
    const resolved = { source: { type: "workspace", id: "w1" }, revision: 0, mode: "latest" as const, definitionId: "d1", formId: "f1" };
    const app = createFormServer({
      repository: {
        ...makeRepositoryStub(),
        resolveBinding: async () => (revision === 0 ? resolved : null),
        saveBinding: async (_ctx: unknown, _scope: unknown, input: { expectedRevision: number }) => {
          if (input.expectedRevision !== revision) throw new Error("BINDING_CONFLICT");
          revision += 1;
          return { revision };
        },
        resetBinding: async (_ctx: unknown, _scope: unknown, expectedRevision: number) => {
          if (expectedRevision !== revision) throw new Error("BINDING_CONFLICT");
          revision = 0;
        }
      } as any,
      policyAdapter: allowCapabilities(["forms.read", "forms.design"]),
      bindingAncestors: async (_ctx, scope) => [scope]
    });

    const save = await request(app).put("/api/bindings/workspace/w1").send({ formId: "f1", mode: "latest", expectedRevision: 0 });
    expect(save.status).toBe(200);
    expect(save.body.revision).toBe(1);

    const stale = await request(app).put("/api/bindings/workspace/w1").send({ formId: "f1", mode: "latest", expectedRevision: 0 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("BINDING_CONFLICT");

    const reset = await request(app).delete("/api/bindings/workspace/w1").send({ expectedRevision: 1 });
    expect(reset.status).toBe(204);

    const afterReset = await request(app).get("/api/bindings/workspace/w1");
    expect(afterReset.status).toBe(200);
    expect(afterReset.body.definitionId).toBe("d1");
  });

  it("blocks publish when capability dependencies are unresolved", async () => {
    const app = createFormServer({
      repository: {
        ...makeRepositoryStub(),
        getDraft: async () => ({
          revision: 2,
          definition: {
            ...definition,
            fields: [
              {
                ...definition.fields[0],
                source: { id: "catalog.items", version: "2", mode: "refresh_on_edit", kind: "options" as const }
              }
            ],
            dependencyVersions: { "catalog.items": "2" }
          }
        })
      } as any,
      policyAdapter: allowCapabilities(["forms.publish"]),
      sourceRegistry: {
        capabilities: async () => ({ "catalog.items": "1" }),
        resolveSourceValue: async () => []
      }
    });

    const response = await request(app).post("/api/forms/f1/publish").send({ expectedRevision: 2 });
    expect(response.status).toBe(422);
    expect(response.body.code).toBe("DEPENDENCIES_UNRESOLVED");
    expect(response.body.dependencies).toContain("catalog.items");
  });

  it("archives and restores forms through authorized endpoints", async () => {
    const calls: boolean[] = [];
    const app = createFormServer({
      repository: {
        ...makeRepositoryStub(),
        archiveForm: async (_ctx: unknown, _formId: string, archived: boolean) => { calls.push(archived); }
      } as any,
      policyAdapter: allowCapabilities(["forms.archive"])
    });

    const archive = await request(app).post("/api/forms/f1/archive").send({});
    expect(archive.status).toBe(204);
    const restore = await request(app).post("/api/forms/f1/restore").send({});
    expect(restore.status).toBe(204);
    expect(calls).toEqual([true, false]);
  });

  it("blocks direct upload deletion when the upload is already part of history", async () => {
    const app = createFormServer({
      repository: {
        ...makeRepositoryStub(),
        getUploadById: async () => ({
          id: "up_db_1",
          uploadId: "upload_1",
          fileName: "demo.txt",
          contentType: "text/plain",
          sizeBytes: 5,
          objectKey: "tenant_demo/upload_1-a1b2",
          attachedRevisionId: "rev_1"
        })
      } as any,
      policyAdapter: allowCapabilities(["forms.delete"])
    });

    const response = await request(app).delete("/api/uploads/upload_1");
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("UPLOAD_IN_HISTORY");
  });

  it("rejects oversized import payloads and unsafe imported input", async () => {
    const app = createFormServer({ repository: makeRepositoryStub() as any, policyAdapter: allowCapabilities(["forms.design"]) });

    const oversized = await request(app).post("/api/forms/import-as-new").send({
      name: "oversized",
      envelope: {
        formatVersion: 1,
        dependencies: {},
        definition: {
          metadata: { formId: "f", name: "x".repeat(1_100_000), schemaVersion: "1.0.0" },
          sections: [{ id: "s", title: "S", order: 0 }],
          fields: [],
          dependencyVersions: {}
        }
      }
    });
    expect(oversized.status).toBe(400);
    expect(oversized.body.code).toBe("UNSAFE_INPUT");

    const unsafe = await request(app).post("/api/forms/import-as-new").send({
      name: "unsafe",
      envelope: {
        formatVersion: 2,
        definition: {},
        constructor: { prototype: { polluted: true } }
      }
    });
    expect(unsafe.status).toBe(400);
    expect(unsafe.body.code).toBe("UNSAFE_INPUT");
  });

  it("lists published versions and returns exact version by publication number", async () => {
    const app = createFormServer({
      repository: makeRepositoryStub() as any,
      policyAdapter: allowCapabilities(["forms.read"])
    });

    const list = await request(app).get("/api/forms/f1/versions");
    expect(list.status).toBe(200);
    expect(list.body[0].formId).toBe("f1");

    const exact = await request(app).get("/api/forms/f1/versions/1");
    expect(exact.status).toBe(200);
    expect(exact.body.id).toBe("d1");
  });

  it("filters record discovery by resource authorization before pagination", async () => {
    const app = createFormServer({
      repository: {
        ...makeRepositoryStub(),
        listRecordSummaries: async (_ctx: unknown, options: { offset: number; limit: number }) => {
          const all = [
            { recordId: "r3", formId: "f3", formName: "Form 3", createdBy: "owner3", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev3", currentRevisionNumber: 3, currentDefinitionId: "d3" },
            { recordId: "r2", formId: "f2", formName: "Form 2", createdBy: "owner2", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev2", currentRevisionNumber: 2, currentDefinitionId: "d2" },
            { recordId: "r1", formId: "f1", formName: "Form 1", createdBy: "owner1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev1", currentRevisionNumber: 1, currentDefinitionId: "d1" }
          ];
          return all.slice(options.offset, options.offset + options.limit);
        }
      } as any,
      policyAdapter: {
        resolveContext: async () => ({ tenantId: "tenant_demo", actorId: "viewer1", isAnonymous: false }),
        authorize: async (_ctx, capability, resource) => {
          if (capability !== "forms.read") {
            return { allowed: false, capabilities: [] };
          }
          if (resource?.recordId === "r2") {
            return { allowed: false, capabilities: ["forms.read"] };
          }
          return { allowed: true, capabilities: ["forms.read"] };
        }
      }
    });

    const response = await request(app).get("/api/records?pageSize=2");
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { recordId: string }) => item.recordId)).toEqual(["r3", "r1"]);
  });
});

it("reports incomplete erasure and supports authorized storage cleanup retry",async()=>{
 let fail=true;let pending=["tenant_demo/object"];
 const app=createFormServer({
  policyAdapter:allowCapabilities(["forms.delete"]),
  repository:{...makeRepositoryStub(),deleteRecordAndRevisions:async()=>({objectKeys:[...pending]}),listStorageDeletions:async()=>pending,acknowledgeStorageDeletion:async()=>{pending=[];}} as any,
  uploadStorage:{storeObject:async()=>({objectKey:"unused",sizeBytes:0}),getObject:async()=>{throw new Error("unused");},deleteObject:async()=>{if(fail)throw new Error("storage unavailable");}}
 });
 const erasure=await request(app).delete("/api/records/record");
 expect(erasure.status).toBe(202);expect(erasure.body.pending).toBe(1);
 fail=false;
 const cleanup=await request(app).post("/api/maintenance/storage-cleanup");
 expect(cleanup.status).toBe(200);expect(cleanup.body).toEqual({deleted:1,pending:0});
});

it("applies record-age retention policy controls beyond upload cleanup queues",async()=>{
 const deletedRecords:string[]=[];
 const acknowledged:string[]=[];
 const deletedObjects:string[]=[];
 const app=createFormServer({
  policyAdapter:allowCapabilities(["forms.delete"]),
  retentionPolicy:{recordMaxAgeMs:60_000,recordRetentionMode:"archived_forms_only",pendingUploadMaxAgeMs:24*60*60*1000},
  repository:{
   ...makeRepositoryStub(),
   listRetentionEligibleRecords:async()=>["record_old_1"],
   deleteRecordAndRevisions:async(_ctx:any,recordId:string)=>{deletedRecords.push(recordId);return {objectKeys:[`tenant_demo/${recordId}/file`]};},
   listExpiredUploads:async()=>[],
   listStorageDeletions:async()=>["tenant_demo/queued_only"],
   acknowledgeStorageDeletion:async(_ctx:any,objectKey:string)=>{acknowledged.push(objectKey);}
  } as any,
  uploadStorage:{
   storeObject:async()=>({objectKey:"unused",sizeBytes:0}),
   getObject:async()=>{throw new Error("unused");},
   deleteObject:async({objectKey})=>{deletedObjects.push(objectKey);}
  }
 });

 const cleanup=await request(app).post("/api/maintenance/storage-cleanup");
 expect(cleanup.status).toBe(200);
 expect(cleanup.body).toEqual({deleted:3,pending:0});
 expect(deletedRecords).toEqual(["record_old_1"]);
 expect(deletedObjects).toEqual(["tenant_demo/record_old_1/file","tenant_demo/queued_only"]);
 expect(acknowledged).toEqual(["tenant_demo/record_old_1/file","tenant_demo/queued_only"]);
});
