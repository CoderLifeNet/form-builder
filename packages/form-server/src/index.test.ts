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
    createRecordRevision: async () => ({ recordId: "r1", revisionId: "rev1", revisionNumber: 1 })
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
