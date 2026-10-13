import { Readable } from "node:stream";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FormDefinition, createStableId } from "@coderlifenet/form-core";
import { FormRepository, MigrationRunner, makePool } from "@coderlifenet/form-postgres";
import { AuthContext, PolicyAdapter, createFormServer } from "./index.js";

type TestIdentity = {
  actorId: string;
  tenantId: string;
};

const dbUrl = process.env.FORM_RUN_DB_TESTS === "true" ? process.env.FORM_TEST_DB_URL : undefined;
const integration = dbUrl ? describe : describe.skip;

const allCapabilities = [
  "forms.design",
  "forms.publish",
  "forms.submit",
  "forms.read",
  "forms.edit",
  "forms.history",
  "forms.export",
  "forms.archive",
  "forms.delete",
  "forms.upload"
];

const identityCapabilities = new Map<string, string[]>([
  ["tenant_alpha:owner1", allCapabilities],
  ["tenant_alpha:collab1", ["forms.submit", "forms.read", "forms.edit", "forms.history", "forms.upload"]],
  ["tenant_alpha:viewer1", ["forms.read", "forms.history"]],
  ["tenant_beta:owner2", allCapabilities]
]);

const viewerAllowedForms = new Set<string>();

function makePolicyAdapter(): PolicyAdapter {
  return {
    async resolveContext(req): Promise<AuthContext> {
      return {
        tenantId: (req.header("x-tenant-id") ?? "tenant_alpha").trim(),
        actorId: (req.header("x-actor-id") ?? "owner1").trim(),
        isAnonymous: false
      };
    },
    async authorize(ctx, capability) {
      const capabilities = identityCapabilities.get(`${ctx.tenantId}:${ctx.actorId}`) ?? [];
      const baseAllowed = capabilities.includes(capability);
      if (!baseAllowed) {
        return {
          allowed: false,
          capabilities
        };
      }

      return {
        allowed: true,
        capabilities
      };
    }
  };
}

function makeResourceAwarePolicyAdapter(): PolicyAdapter {
  return {
    async resolveContext(req): Promise<AuthContext> {
      return {
        tenantId: (req.header("x-tenant-id") ?? "tenant_alpha").trim(),
        actorId: (req.header("x-actor-id") ?? "owner1").trim(),
        isAnonymous: false
      };
    },
    async authorize(ctx, capability, resource) {
      const capabilities = identityCapabilities.get(`${ctx.tenantId}:${ctx.actorId}`) ?? [];
      const baseAllowed = capabilities.includes(capability);
      if (!baseAllowed) {
        return { allowed: false, capabilities };
      }

      if (ctx.actorId === "viewer1" && resource?.formId && !viewerAllowedForms.has(resource.formId)) {
        return { allowed: false, capabilities };
      }

      return {
        allowed: true,
        capabilities
      };
    }
  };
}

function withIdentity(req: request.Test, identity: TestIdentity): request.Test {
  return req.set("x-tenant-id", identity.tenantId).set("x-actor-id", identity.actorId);
}

function createBaseDefinition(name: string): FormDefinition {
  return {
    metadata: {
      formId: createStableId("meta"),
      name,
      schemaVersion: "1.0.0"
    },
    sections: [{ id: "details", title: "Details", order: 0 }],
    fields: [
      {
        id: "field_title",
        key: "field_title",
        type: "text",
        label: "Title v1",
        required: true,
        sectionId: "details",
        row: 0,
        width: 12,
        rules: []
      }
    ],
    dependencyVersions: {}
  };
}

let idempotencyCounter = 0;
function nextIdempotencyKey(): string {
  idempotencyCounter += 1;
  return `idem_${Date.now()}_${idempotencyCounter}`;
}

integration("form server acceptance integration", () => {
  let pool: ReturnType<typeof makePool>;
  let repo: FormRepository;
  let app: ReturnType<typeof createFormServer>;

  beforeAll(async () => {
    pool = makePool(dbUrl);
    repo = new FormRepository(pool);
    const runner = new MigrationRunner(pool);
    await runner.migrate();

    app = createFormServer({
      repository: repo,
      policyAdapter: makeResourceAwarePolicyAdapter(),
      sourceRegistry: {
        async capabilities() { return { "profile.first_name": "1" }; },
        async resolveSourceValue(sourceId) {
          if (sourceId === "profile.first_name") {
            return "Owner";
          }
          if (sourceId === "profile.last_name") {
            return "User";
          }
          throw new Error(`SOURCE_NOT_REGISTERED:${sourceId}`);
        }
      },
      uploadStorage: {
        async storeObject(input) {
          let size = 0;
          for await (const chunk of input.stream) {
            size += Buffer.byteLength(chunk as Buffer);
          }
          return { objectKey: `${input.tenantId}/${input.uploadId}`, sizeBytes: size };
        },
        async getObject(input) {
          return {
            stream: Readable.from(Buffer.from("downloadable")),
            sizeBytes: 12,
            contentType: input.contentType
          };
        },
        async deleteObject() {
          return;
        }
      }
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("keeps existing record history tied to its original published definition after later publish, duplicate, and import replace", async () => {
    const owner = { actorId: "owner1", tenantId: "tenant_alpha" };
    const created = await withIdentity(
      request(app).post("/api/forms").send({
        name: `History form ${Date.now()}`,
        definition: createBaseDefinition("History form")
      }),
      owner
    );

    expect(created.status).toBe(201);
    const formId = created.body.formId as string;
    expect(formId).toBeTruthy();

    const publishV1 = await withIdentity(
      request(app).post(`/api/forms/${formId}/publish`).send({ expectedRevision: created.body.draftRevision }),
      owner
    );
    expect(publishV1.status).toBe(201);
    const definitionV1Id = publishV1.body.definitionId as string;

    const firstSubmit = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", nextIdempotencyKey())
        .send({
          formId,
          definitionId: definitionV1Id,
          values: { field_title: "first revision value" }
        }),
      owner
    );
    expect(firstSubmit.status).toBe(201);
    const recordId = firstSubmit.body.recordId as string;

    const draft = await withIdentity(request(app).get(`/api/forms/${formId}/draft`), owner);
    const updatedDefinition = {
      ...draft.body.definition,
      fields: draft.body.definition.fields.map((field: FormDefinition["fields"][number]) =>
        field.id === "field_title" ? { ...field, label: "Title v2" } : field
      )
    } satisfies FormDefinition;

    const saveV2 = await withIdentity(
      request(app).put(`/api/forms/${formId}/draft`).send({
        expectedRevision: draft.body.revision,
        definition: updatedDefinition
      }),
      owner
    );
    expect(saveV2.status).toBe(200);

    const publishV2 = await withIdentity(
      request(app).post(`/api/forms/${formId}/publish`).send({ expectedRevision: saveV2.body.revision }),
      owner
    );
    expect(publishV2.status).toBe(201);

    const duplicate = await withIdentity(request(app).post(`/api/forms/${formId}/duplicate`).send({}), owner);
    expect(duplicate.status).toBe(201);

    const exported = await withIdentity(request(app).get(`/api/forms/${formId}/export`), owner);
    expect(exported.status).toBe(200);

    const imported = await withIdentity(
      request(app).post("/api/forms/import-as-new").send({
        name: `Imported ${Date.now()}`,
        envelope: exported.body
      }),
      owner
    );
    expect(imported.status).toBe(201);

    const replacePreview = await withIdentity(
      request(app).post(`/api/forms/${formId}/import-replace/preview`).send({ envelope: exported.body }),
      owner
    );
    expect(replacePreview.status).toBe(200);

    const currentDraft = await withIdentity(request(app).get(`/api/forms/${formId}/draft`), owner);
    const replaceCommit = await withIdentity(
      request(app).post(`/api/forms/${formId}/import-replace/commit`).send({
        expectedRevision: currentDraft.body.revision,
        envelope: exported.body
      }),
      owner
    );
    expect(replaceCommit.status).toBe(200);

    const history = await withIdentity(request(app).get(`/api/records/${recordId}/history`), owner);
    expect(history.status).toBe(200);
    expect(history.body.length).toBe(1);
    expect(history.body[0].definitionId).toBe(definitionV1Id);

    const definitionV1 = await withIdentity(request(app).get(`/api/definitions/${definitionV1Id}`), owner);
    expect(definitionV1.status).toBe(200);
    expect(definitionV1.body.definition.fields.find((f: FormDefinition["fields"][number]) => f.id === "field_title")?.label).toBe("Title v1");

    const secondSubmitUsingV1 = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", createStableId("idem"))
        .send({
          formId,
          definitionId: definitionV1Id,
          recordId,
          expectedRevision: 1,
          values: { field_title: "second revision still v1" }
        }),
      owner
    );

    expect(secondSubmitUsingV1.status).toBe(201);

    const historyAfter = await withIdentity(request(app).get(`/api/records/${recordId}/history`), owner);
    expect(historyAfter.status).toBe(200);
    expect(historyAfter.body).toHaveLength(2);
    expect(historyAfter.body[0].definitionId).toBe(definitionV1Id);
    expect(historyAfter.body[1].definitionId).toBe(definitionV1Id);
  });

  it("applies dynamic sources, conditional required behavior, and returns API field errors", async () => {
    const owner = { actorId: "owner1", tenantId: "tenant_alpha" };
    const definition: FormDefinition = {
      metadata: {
        formId: createStableId("meta"),
        name: "Dynamic source form",
        schemaVersion: "1.0.0"
      },
      sections: [{ id: "s", title: "Details", order: 0 }],
      fields: [
        {
          id: "field_first_name",
          key: "field_first_name",
          type: "text",
          label: "First name",
          required: false,
          sectionId: "s",
          row: 0,
          width: 12,
          source: { id: "profile.first_name", version: "1", mode: "display_only" },
          rules: []
        },
        {
          id: "field_title",
          key: "field_title",
          type: "text",
          label: "Title",
          required: false,
          sectionId: "s",
          row: 1,
          width: 12,
          rules: [
            {
              id: "rule_required_if_owner",
              behavior: "required",
              sourceFieldId: "field_first_name",
              operator: "equals",
              value: "Owner"
            }
          ]
        }
      ],
      dependencyVersions: {
        "profile.first_name": "1"
      }
    };

    const created = await withIdentity(
      request(app).post("/api/forms").send({
        name: `Dynamic ${Date.now()}`,
        definition
      }),
      owner
    );
    expect(created.status).toBe(201);

    const publish = await withIdentity(
      request(app).post(`/api/forms/${created.body.formId}/publish`).send({ expectedRevision: created.body.draftRevision }),
      owner
    );
    expect(publish.status).toBe(201);

    const missingTitle = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", nextIdempotencyKey())
        .send({
          formId: created.body.formId,
          definitionId: publish.body.definitionId,
          values: {}
        }),
      owner
    );

    expect(missingTitle.status).toBe(422);
    expect(missingTitle.body.code).toBe("VALIDATION_FAILED");
    expect(missingTitle.body.fieldErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldId: "field_title", code: "REQUIRED" })
      ])
    );

    const success = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", nextIdempotencyKey())
        .send({
          formId: created.body.formId,
          definitionId: publish.body.definitionId,
          values: { field_title: "filled" }
        }),
      owner
    );

    expect(success.status).toBe(201);

    const history = await withIdentity(request(app).get(`/api/records/${success.body.recordId}/history`), owner);
    expect(history.status).toBe(200);
    expect(history.body[0].values.field_first_name).toBe("Owner");
    expect(history.body[0].values.field_title).toBe("filled");
  });

  it("supports single and multi-upload submission and prevents cross-tenant access", async () => {
    const owner = { actorId: "owner1", tenantId: "tenant_alpha" };
    const outsider = { actorId: "owner2", tenantId: "tenant_beta" };

    const definition: FormDefinition = {
      metadata: {
        formId: createStableId("meta"),
        name: "Upload form",
        schemaVersion: "1.0.0"
      },
      sections: [{ id: "s", title: "Files", order: 0 }],
      fields: [
        {
          id: "field_single_file",
          key: "field_single_file",
          type: "single_file",
          label: "Single",
          required: true,
          sectionId: "s",
          row: 0,
          width: 12,
          rules: []
        },
        {
          id: "field_multi_file",
          key: "field_multi_file",
          type: "multi_file",
          label: "Multiple",
          required: false,
          sectionId: "s",
          row: 1,
          width: 12,
          rules: []
        }
      ],
      dependencyVersions: {}
    };

    const created = await withIdentity(
      request(app).post("/api/forms").send({ name: `Upload ${Date.now()}`, definition }),
      owner
    );
    expect(created.status).toBe(201);

    const publish = await withIdentity(
      request(app).post(`/api/forms/${created.body.formId}/publish`).send({ expectedRevision: created.body.draftRevision }),
      owner
    );
    expect(publish.status).toBe(201);

    const up1 = await withIdentity(
      request(app)
        .post(`/api/forms/${created.body.formId}/uploads`)
        .set("content-type", "application/octet-stream")
        .set("x-file-name", "a.txt")
        .set("x-file-content-type", "text/plain")
        .send(Buffer.from("alpha")),
      owner
    );

    const up2 = await withIdentity(
      request(app)
        .post(`/api/forms/${created.body.formId}/uploads`)
        .set("content-type", "application/octet-stream")
        .set("x-file-name", "b.txt")
        .set("x-file-content-type", "text/plain")
        .send(Buffer.from("beta")),
      owner
    );

    expect(up1.status).toBe(201);
    expect(up2.status).toBe(201);

    const saved = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", nextIdempotencyKey())
        .send({
          formId: created.body.formId,
          definitionId: publish.body.definitionId,
          values: {
            field_single_file: up1.body.uploadId,
            field_multi_file: [up1.body.uploadId, up2.body.uploadId]
          },
          uploadIds: [up1.body.uploadId, up2.body.uploadId]
        }),
      owner
    );

    expect(saved.status).toBe(201);

    const history = await withIdentity(request(app).get(`/api/records/${saved.body.recordId}/history`), owner);
    expect(history.status).toBe(200);
    expect(history.body[0].values.field_single_file).toBe(up1.body.uploadId);
    expect(history.body[0].values.field_multi_file).toEqual([up1.body.uploadId, up2.body.uploadId]);

    const ownDownload = await withIdentity(request(app).get(`/api/uploads/${up1.body.uploadId}/download`), owner);
    expect(ownDownload.status).toBe(200);
    expect(ownDownload.header["content-disposition"]).toContain("a.txt");

    const outsiderDraft = await withIdentity(request(app).get(`/api/forms/${created.body.formId}/draft`), outsider);
    expect(outsiderDraft.status).toBe(404);

    const outsiderDefinitionRead = await withIdentity(
      request(app).get(`/api/definitions/${publish.body.definitionId}`),
      outsider
    );
    expect(outsiderDefinitionRead.status).toBe(404);

    const outsiderExport = await withIdentity(request(app).get(`/api/forms/${created.body.formId}/export`), outsider);
    expect(outsiderExport.status).toBe(404);

    const outsiderHistory = await withIdentity(request(app).get(`/api/records/${saved.body.recordId}/history`), outsider);
    expect(outsiderHistory.status).toBe(404);
    expect(outsiderHistory.body.code).toBe("RECORD_NOT_FOUND");

    const outsiderDownload = await withIdentity(request(app).get(`/api/uploads/${up1.body.uploadId}/download`), outsider);
    expect(outsiderDownload.status).toBe(404);
  });

  it("remaps stable IDs and rule references for duplicate and import-as-new", async () => {
    const owner = { actorId: "owner1", tenantId: "tenant_alpha" };
    const definition: FormDefinition = {
      metadata: {
        formId: createStableId("meta"),
        name: "Remap form",
        schemaVersion: "1.0.0"
      },
      sections: [{ id: "s", title: "Main", order: 0 }],
      fields: [
        {
          id: "field_selector",
          key: "field_selector",
          type: "multi_select",
          label: "Selector",
          required: false,
          sectionId: "s",
          row: 0,
          width: 12,
          options: [{ id: "option_a", label: "A" }],
          rules: []
        },
        {
          id: "field_dep",
          key: "field_dep",
          type: "text",
          label: "Dependent",
          required: false,
          sectionId: "s",
          row: 1,
          width: 12,
          rules: [
            {
              id: "rule_dep",
              behavior: "required",
              sourceFieldId: "field_selector",
              operator: "includes_option",
              value: "option_a"
            }
          ]
        }
      ],
      dependencyVersions: {}
    };

    const created = await withIdentity(
      request(app).post("/api/forms").send({ name: `Remap ${Date.now()}`, definition }),
      owner
    );
    expect(created.status).toBe(201);

    const exported = await withIdentity(request(app).get(`/api/forms/${created.body.formId}/export`), owner);
    expect(exported.status).toBe(200);

    const duplicate = await withIdentity(request(app).post(`/api/forms/${created.body.formId}/duplicate`).send({}), owner);
    expect(duplicate.status).toBe(201);

    const duplicateDraft = await withIdentity(request(app).get(`/api/forms/${duplicate.body.formId}/draft`), owner);
    expect(duplicateDraft.status).toBe(200);

    const duplicateSelector = duplicateDraft.body.definition.fields.find((f: FormDefinition["fields"][number]) => f.key === "field_selector");
    const duplicateDependent = duplicateDraft.body.definition.fields.find((f: FormDefinition["fields"][number]) => f.key === "field_dep");

    expect(duplicateSelector?.id).not.toBe("field_selector");
    expect(duplicateDependent?.id).not.toBe("field_dep");
    expect(duplicateDependent?.rules[0]?.sourceFieldId).toBe(duplicateSelector?.id);
    expect(duplicateDependent?.rules[0]?.value).toBe(duplicateSelector?.options?.[0]?.id);

    const imported = await withIdentity(
      request(app).post("/api/forms/import-as-new").send({
        name: `Remap imported ${Date.now()}`,
        envelope: exported.body
      }),
      owner
    );
    expect(imported.status).toBe(201);

    const importDraft = await withIdentity(request(app).get(`/api/forms/${imported.body.formId}/draft`), owner);
    expect(importDraft.status).toBe(200);

    const importSelector = importDraft.body.definition.fields.find((f: FormDefinition["fields"][number]) => f.key === "field_selector");
    const importDependent = importDraft.body.definition.fields.find((f: FormDefinition["fields"][number]) => f.key === "field_dep");

    expect(importSelector?.id).not.toBe("field_selector");
    expect(importDependent?.rules[0]?.sourceFieldId).toBe(importSelector?.id);
    expect(importDependent?.rules[0]?.value).toBe(importSelector?.options?.[0]?.id);
  });

  it("supports explicit migration preview and validation-gated commit", async () => {
    const owner = { actorId: "owner1", tenantId: "tenant_alpha" };

    const v1: FormDefinition = {
      metadata: {
        formId: createStableId("meta"),
        name: "Migration form",
        schemaVersion: "1.0.0"
      },
      sections: [{ id: "s", title: "Main", order: 0 }],
      fields: [
        {
          id: "field_title",
          key: "field_title",
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

    const created = await withIdentity(request(app).post("/api/forms").send({ name: `Migration ${Date.now()}`, definition: v1 }), owner);
    expect(created.status).toBe(201);

    const publishV1 = await withIdentity(
      request(app).post(`/api/forms/${created.body.formId}/publish`).send({ expectedRevision: created.body.draftRevision }),
      owner
    );
    expect(publishV1.status).toBe(201);

    const saved = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", nextIdempotencyKey())
        .send({
          formId: created.body.formId,
          definitionId: publishV1.body.definitionId,
          values: { field_title: "before migration" }
        }),
      owner
    );
    expect(saved.status).toBe(201);

    const draft = await withIdentity(request(app).get(`/api/forms/${created.body.formId}/draft`), owner);
    const v2 = {
      ...draft.body.definition,
      fields: [
        ...draft.body.definition.fields,
        {
          id: "field_required_new",
          key: "field_required_new",
          type: "text",
          label: "Required new",
          required: true,
          sectionId: "s",
          row: draft.body.definition.fields.length,
          width: 12,
          rules: []
        }
      ]
    } satisfies FormDefinition;

    const savedV2 = await withIdentity(
      request(app).put(`/api/forms/${created.body.formId}/draft`).send({
        expectedRevision: draft.body.revision,
        definition: v2
      }),
      owner
    );
    expect(savedV2.status).toBe(200);

    const publishV2 = await withIdentity(
      request(app).post(`/api/forms/${created.body.formId}/publish`).send({ expectedRevision: savedV2.body.revision }),
      owner
    );
    expect(publishV2.status).toBe(201);

    const preview = await withIdentity(
      request(app).post(`/api/records/${saved.body.recordId}/migrations/preview`).send({
        targetDefinitionId: publishV2.body.definitionId
      }),
      owner
    );
    expect(preview.status).toBe(200);
    expect(preview.body.missingRequiredFieldIds).toEqual(expect.arrayContaining(["field_required_new"]));

    const blockedCommit = await withIdentity(
      request(app).post(`/api/records/${saved.body.recordId}/migrations/commit`).send({
        targetDefinitionId: publishV2.body.definitionId
      }),
      owner
    );
    expect(blockedCommit.status).toBe(422);
    expect(blockedCommit.body.code).toBe("MIGRATION_VALIDATION_FAILED");
  });

  it("rejects unsupported regex patterns during submission validation", async () => {
    const owner = { actorId: "owner1", tenantId: "tenant_alpha" };

    const definition: FormDefinition = {
      metadata: {
        formId: createStableId("meta"),
        name: "Regex safety form",
        schemaVersion: "1.0.0"
      },
      sections: [{ id: "s", title: "Main", order: 0 }],
      fields: [
        {
          id: "field_regex",
          key: "field_regex",
          type: "text",
          label: "Regex field",
          required: true,
          sectionId: "s",
          row: 0,
          width: 12,
          rules: [],
          validation: {
            regex: "("
          }
        }
      ],
      dependencyVersions: {}
    };

    const created = await withIdentity(
      request(app).post("/api/forms").send({ name: `Regex safety ${Date.now()}`, definition }),
      owner
    );
    expect(created.status).toBe(201);

    const published = await withIdentity(
      request(app).post(`/api/forms/${created.body.formId}/publish`).send({ expectedRevision: created.body.draftRevision }),
      owner
    );
    expect(published.status).toBe(201);

    const submitted = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", nextIdempotencyKey())
        .send({
          formId: created.body.formId,
          definitionId: published.body.definitionId,
          values: { field_regex: "aa" }
        }),
      owner
    );

    expect(submitted.status).toBe(422);
    expect(submitted.body.code).toBe("VALIDATION_FAILED");
    expect(submitted.body.fieldErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldId: "field_regex", code: "REGEX_UNSAFE" })
      ])
    );
  });

  it("supports record discovery/version discovery with resource authorization and safe edit/attachment lifecycle", async () => {
    const owner = { actorId: "owner1", tenantId: "tenant_alpha" };
    const collab = { actorId: "collab1", tenantId: "tenant_alpha" };
    const viewer = { actorId: "viewer1", tenantId: "tenant_alpha" };
    const outsider = { actorId: "owner2", tenantId: "tenant_beta" };

    const definitionV1: FormDefinition = {
      metadata: {
        formId: createStableId("meta"),
        name: "Discovery form",
        schemaVersion: "1.0.0"
      },
      sections: [{ id: "s", title: "Main", order: 0 }],
      fields: [
        {
          id: "field_title",
          key: "field_title",
          type: "text",
          label: "Title",
          required: true,
          sectionId: "s",
          row: 0,
          width: 12,
          rules: []
        },
        {
          id: "field_attachment",
          key: "field_attachment",
          type: "single_file",
          label: "Attachment",
          required: false,
          sectionId: "s",
          row: 1,
          width: 12,
          rules: []
        }
      ],
      dependencyVersions: {}
    };

    const created = await withIdentity(request(app).post("/api/forms").send({ name: `Discovery ${Date.now()}`, definition: definitionV1 }), owner);
    expect(created.status).toBe(201);
    const formId = created.body.formId as string;

    viewerAllowedForms.add(formId);

    const publishV1 = await withIdentity(
      request(app).post(`/api/forms/${formId}/publish`).send({ expectedRevision: created.body.draftRevision }),
      owner
    );
    expect(publishV1.status).toBe(201);

    const uploaded = await withIdentity(
      request(app)
        .post(`/api/forms/${formId}/uploads`)
        .set("content-type", "application/octet-stream")
        .set("x-file-name", "evidence.pdf")
        .set("x-file-content-type", "application/pdf")
        .send(Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n")),
      owner
    );
    expect(uploaded.status).toBe(201);

    const ownerSubmission = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", createStableId("idem"))
        .send({
          formId,
          definitionId: publishV1.body.definitionId,
          values: { field_title: "owner submission", field_attachment: uploaded.body.uploadId },
          uploadIds: [uploaded.body.uploadId]
        }),
      owner
    );
    expect(ownerSubmission.status).toBe(201);
    const recordId = ownerSubmission.body.recordId as string;

    const draft = await withIdentity(request(app).get(`/api/forms/${formId}/draft`), owner);
    const definitionV2 = {
      ...draft.body.definition,
      sections: [...draft.body.definition.sections, { id: "s2", title: "Follow-up", order: 1 }],
      fields: [
        ...draft.body.definition.fields,
        {
          id: "field_follow_up",
          key: "field_follow_up",
          type: "multiline",
          label: "Follow-up details",
          required: false,
          sectionId: "s2",
          row: 0,
          width: 12,
          rules: []
        }
      ]
    } satisfies FormDefinition;

    const savedV2 = await withIdentity(
      request(app).put(`/api/forms/${formId}/draft`).send({ expectedRevision: draft.body.revision, definition: definitionV2 }),
      owner
    );
    expect(savedV2.status).toBe(200);

    const publishV2 = await withIdentity(
      request(app).post(`/api/forms/${formId}/publish`).send({ expectedRevision: savedV2.body.revision }),
      owner
    );
    expect(publishV2.status).toBe(201);

    const collabSubmission = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", createStableId("idem"))
        .send({
          formId,
          definitionId: publishV2.body.definitionId,
          values: { field_title: "collab submission", field_follow_up: "new layout field" }
        }),
      collab
    );
    expect(collabSubmission.status).toBe(201);

    const versions = await withIdentity(request(app).get(`/api/forms/${formId}/versions`), owner);
    expect(versions.status).toBe(200);
    expect(versions.body.length).toBeGreaterThanOrEqual(2);

    const versionOne = await withIdentity(request(app).get(`/api/forms/${formId}/versions/1`), owner);
    expect(versionOne.status).toBe(200);
    expect(versionOne.body.id).toBe(publishV1.body.definitionId);

    const recordList = await withIdentity(request(app).get(`/api/records?formId=${formId}&pageSize=10`), owner);
    expect(recordList.status).toBe(200);
    expect(recordList.body.items.map((item: { recordId: string }) => item.recordId)).toEqual(
      expect.arrayContaining([ownerSubmission.body.recordId, collabSubmission.body.recordId])
    );

    const ownerFiltered = await withIdentity(request(app).get(`/api/records?formId=${formId}&createdBy=owner1&pageSize=10`), owner);
    expect(ownerFiltered.status).toBe(200);
    expect(ownerFiltered.body.items.every((item: { createdBy: string }) => item.createdBy === "owner1")).toBe(true);

    const viewerList = await withIdentity(request(app).get(`/api/records?pageSize=10`), viewer);
    expect(viewerList.status).toBe(200);
    expect(viewerList.body.items.every((item: { formId: string }) => item.formId === formId)).toBe(true);

    const conflict = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", createStableId("idem"))
        .send({
          formId,
          definitionId: publishV1.body.definitionId,
          recordId,
          expectedRevision: 99,
          values: { field_title: "stale edit", field_attachment: uploaded.body.uploadId },
          uploadIds: [uploaded.body.uploadId]
        }),
      owner
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("RECORD_CONFLICT");

    const edit = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", createStableId("idem"))
        .send({
          formId,
          definitionId: publishV1.body.definitionId,
          recordId,
          expectedRevision: 1,
          values: { field_title: "owner edit", field_attachment: uploaded.body.uploadId },
          uploadIds: [uploaded.body.uploadId]
        }),
      owner
    );
    expect(edit.status).toBe(201);

    const staleFollowUpEdit = await withIdentity(
      request(app)
        .post("/api/records")
        .set("idempotency-key", createStableId("idem"))
        .send({
          formId,
          definitionId: publishV1.body.definitionId,
          recordId,
          expectedRevision: 1,
          values: { field_title: "late stale edit", field_attachment: uploaded.body.uploadId },
          uploadIds: [uploaded.body.uploadId]
        }),
      owner
    );
    expect(staleFollowUpEdit.status).toBe(409);
    expect(staleFollowUpEdit.body.code).toBe("RECORD_CONFLICT");

    const history = await withIdentity(request(app).get(`/api/records/${recordId}/history`), owner);
    expect(history.status).toBe(200);
    expect(history.body[0].values.field_attachment).toBe(uploaded.body.uploadId);

    const ownerDownload = await withIdentity(request(app).get(`/api/uploads/${uploaded.body.uploadId}/download`), owner);
    expect(ownerDownload.status).toBe(200);

    const outsiderDownload = await withIdentity(request(app).get(`/api/uploads/${uploaded.body.uploadId}/download`), outsider);
    expect(outsiderDownload.status).toBe(404);
  });
});
