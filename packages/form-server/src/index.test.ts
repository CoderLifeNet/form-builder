import request from "supertest";
import { describe, expect, it } from "vitest";
import { createFormServer } from "./index.js";

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
  return {
    createForm: async () => ({ formId: "f1", draftRevision: 1 }),
    getDraft: async () => ({ revision: 1, definition }),
    saveDraft: async () => ({ revision: 2 }),
    publishDraft: async () => ({ definitionId: "d1", publicationVersion: 1 }),
    withIdempotency: async (_ctx: any, _op: string, _key: string, _payload: unknown, handler: any) => handler(),
    createRecordRevision: async () => ({ recordId: "r1", revisionId: "rev1", revisionNumber: 1 })
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
    const app = createFormServer({ repository: makeRepositoryStub() as any });
    const response = await request(app)
      .post("/api/records")
      .set("x-tenant-id", "tenant_demo")
      .set("x-actor-id", "owner1")
      .send({ formId: "f1", definitionId: "d1", values: { title: "hello" } });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("IDEMPOTENCY_REQUIRED");
  });

  it("returns field validation errors", async () => {
    const app = createFormServer({ repository: makeRepositoryStub() as any });
    const response = await request(app)
      .post("/api/records")
      .set("x-tenant-id", "tenant_demo")
      .set("x-actor-id", "owner1")
      .set("idempotency-key", "k1")
      .send({ formId: "f1", definitionId: "d1", values: { title: "x" } });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe("VALIDATION_FAILED");
    expect(response.body.fieldErrors[0].fieldId).toBe("field_title");
  });
});
