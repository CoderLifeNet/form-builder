import request from "supertest";
import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
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
    getFormById: async () => ({
      id: "f1",
      name: "Form",
      description: null,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      draftRevision: 1,
      publishedVersion: 1,
      publishedDefinitionId: "d1",
      hasUnpublishedChanges: false,
      lifecycleState: "published_clean"
    }),
    renameForm: async () => undefined,
    getPublishedDefinitionById: async () => ({ id: "d1", formId: "f1", publicationVersion: 1, definition }),
    createUpload: async () => ({ id: "up_db_1", uploadId: "upload_1" }),
    getUploadById: async () => ({
      id: "up_db_1",
      uploadId: "upload_1",
      fileName: "demo.txt",
      contentType: "text/plain",
      sizeBytes: 5,
      objectKey: "tenant_demo/upload_1-a1b2",
      createdBy: "owner1",
      attachedRecordId: null
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

  it("renames forms for authorized designers", async () => {
    let renamedTo = "";
    const app = createFormServer({
      repository: {
        ...makeRepositoryStub(),
        renameForm: async (_ctx: unknown, _formId: string, name: string) => {
          renamedTo = name;
        },
        getFormById: async () => ({
          id: "f1",
          name: renamedTo || "Form",
          description: null,
          archived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          draftRevision: 1,
          publishedVersion: 1,
          publishedDefinitionId: "d1",
          hasUnpublishedChanges: false,
          lifecycleState: "published_clean" as const
        })
      } as any,
      policyAdapter: allowCapabilities(["forms.design"])
    });

    const response = await request(app)
      .patch("/api/forms/f1")
      .send({ name: "Renamed form" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Renamed form");
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

  it("passes uploader context when authorizing unattached upload downloads", async () => {
    const app = createFormServer({
      repository: {
        ...makeRepositoryStub(),
        getUploadById: async () => ({
          id: "upload_1",
          tenantId: "tenant_demo",
          formId: "f1",
          objectKey: "tenant_demo/upload_1-a1b2",
          fileName: "demo.txt",
          contentType: "text/plain",
          sizeBytes: 5,
          status: "completed",
          createdBy: "uploader_2",
          attachedRevisionId: null,
          attachedRecordId: null
        })
      } as any,
      policyAdapter: {
        resolveContext: async () => ({ tenantId: "tenant_demo", actorId: "viewer1", isAnonymous: false }),
        authorize: async (_ctx, capability, resource) => {
          if (capability !== "forms.read") {
            return { allowed: false, capabilities: [] };
          }
          if (resource?.uploadId && resource?.createdBy === "uploader_2") {
            return { allowed: false, capabilities: ["forms.read"] };
          }
          return { allowed: true, capabilities: ["forms.read"] };
        }
      },
      uploadStorage: {
        storeObject: async () => ({ objectKey: "unused", sizeBytes: 0 }),
        getObject: async () => ({ stream: Readable.from(Buffer.from("hello")), sizeBytes: 5, contentType: "text/plain" }),
        deleteObject: async () => undefined
      }
    });

    const response = await request(app).get("/api/uploads/upload_1/download");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  it("authorizes attached upload downloads using owning-record resource context", async () => {
    const app = createFormServer({
      repository: {
        ...makeRepositoryStub(),
        getUploadById: async () => ({
          id: "upload_2",
          tenantId: "tenant_demo",
          formId: "f1",
          objectKey: "tenant_demo/upload_2-a1b2",
          fileName: "evidence.pdf",
          contentType: "application/pdf",
          sizeBytes: 8,
          status: "completed",
          createdBy: "collab1",
          attachedRevisionId: "rev2",
          attachedRecordId: "record_denied"
        }),
        getRecordSummaryById: async () => ({
          recordId: "record_denied",
          formId: "f1",
          formName: "Form",
          createdBy: "collab1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentRevisionId: "rev2",
          currentRevisionNumber: 2,
          currentDefinitionId: "d1"
        })
      } as any,
      policyAdapter: {
        resolveContext: async () => ({ tenantId: "tenant_demo", actorId: "viewer1", isAnonymous: false }),
        authorize: async (_ctx, capability, resource) => {
          if (capability !== "forms.read") {
            return { allowed: false, capabilities: [] };
          }
          if (resource?.recordId === "record_denied") {
            return { allowed: false, capabilities: ["forms.read"] };
          }
          return { allowed: true, capabilities: ["forms.read"] };
        }
      },
      uploadStorage: {
        storeObject: async () => ({ objectKey: "unused", sizeBytes: 0 }),
        getObject: async () => ({ stream: Readable.from(Buffer.from("%PDF-1.7")), sizeBytes: 8, contentType: "application/pdf" }),
        deleteObject: async () => undefined
      }
    });

    const response = await request(app).get("/api/uploads/upload_2/download");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
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
          createdBy: "owner1",
          attachedRevisionId: "rev_1",
          attachedRecordId: "record_1"
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

  it("paginates record discovery without skipping unconsumed authorized rows", async () => {
    const app = createFormServer({
      repository: {
        ...makeRepositoryStub(),
        listRecordSummaries: async (_ctx: unknown, options: { offset: number; limit: number }) => {
          const all = [
            { recordId: "r1", formId: "f1", formName: "Form 1", createdBy: "owner1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev1", currentRevisionNumber: 1, currentDefinitionId: "d1" },
            { recordId: "r2", formId: "f1", formName: "Form 1", createdBy: "owner2", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev2", currentRevisionNumber: 2, currentDefinitionId: "d1" },
            { recordId: "r3", formId: "f1", formName: "Form 1", createdBy: "owner3", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev3", currentRevisionNumber: 3, currentDefinitionId: "d1" },
            { recordId: "r4", formId: "f1", formName: "Form 1", createdBy: "owner4", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev4", currentRevisionNumber: 4, currentDefinitionId: "d1" },
            { recordId: "r5", formId: "f1", formName: "Form 1", createdBy: "owner5", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev5", currentRevisionNumber: 5, currentDefinitionId: "d1" },
            { recordId: "r6", formId: "f1", formName: "Form 1", createdBy: "owner6", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev6", currentRevisionNumber: 6, currentDefinitionId: "d1" },
            { recordId: "r7", formId: "f1", formName: "Form 1", createdBy: "owner7", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev7", currentRevisionNumber: 7, currentDefinitionId: "d1" },
            { recordId: "r8", formId: "f1", formName: "Form 1", createdBy: "owner8", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentRevisionId: "rev8", currentRevisionNumber: 8, currentDefinitionId: "d1" }
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
          if (resource?.recordId === "r2" || resource?.recordId === "r5") {
            return { allowed: false, capabilities: ["forms.read"] };
          }
          return { allowed: true, capabilities: ["forms.read"] };
        }
      }
    });

    const page1 = await request(app).get("/api/records?pageSize=2&cursor=0");
    expect(page1.status).toBe(200);
    expect(page1.body.items.map((item: { recordId: string }) => item.recordId)).toEqual(["r1", "r3"]);
    expect(page1.body.nextCursor).toBe(3);

    const page2 = await request(app).get(`/api/records?pageSize=2&cursor=${page1.body.nextCursor}`);
    expect(page2.status).toBe(200);
    expect(page2.body.items.map((item: { recordId: string }) => item.recordId)).toEqual(["r4", "r6"]);

    const page3 = await request(app).get(`/api/records?pageSize=2&cursor=${page2.body.nextCursor}`);
    expect(page3.status).toBe(200);
    expect(page3.body.items.map((item: { recordId: string }) => item.recordId)).toEqual(["r7", "r8"]);
    expect(page3.body.nextCursor).toBeNull();

    const allPermitted = [...page1.body.items, ...page2.body.items, ...page3.body.items].map((item: { recordId: string }) => item.recordId);
    expect(allPermitted).toEqual(["r1", "r3", "r4", "r6", "r7", "r8"]);
    expect(new Set(allPermitted).size).toBe(allPermitted.length);
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
