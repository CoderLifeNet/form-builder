import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FormRepository, makePool, MigrationRunner } from "./index.js";

const dbUrl = process.env.FORM_DB_URL;

const integration = dbUrl ? describe : describe.skip;

integration("form postgres integration", () => {
  let pool: ReturnType<typeof makePool>;
  let repo: FormRepository;
  let runner: MigrationRunner;

  beforeAll(async () => {
    pool = makePool(dbUrl);
    repo = new FormRepository(pool);
    runner = new MigrationRunner(pool);
    await runner.migrate();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates and publishes a form, then writes record revisions", async () => {
    const ctx = { tenantId: "tenant_test", actorId: "owner1" };

    const created = await repo.createForm(ctx, {
      name: `Integration ${Date.now()}`,
      draft: {
        metadata: {
          formId: "it_form",
          name: "IT Form",
          schemaVersion: "1.0.0"
        },
        sections: [{ id: "s1", title: "S1", order: 0 }],
        fields: [
          {
            id: "field_title",
            key: "title",
            type: "text",
            label: "Title",
            required: true,
            sectionId: "s1",
            row: 0,
            width: 12,
            rules: []
          }
        ],
        dependencyVersions: {}
      }
    });

    const published = await repo.publishDraft(ctx, created.formId, created.draftRevision);
    const saved = await repo.createRecordRevision({
      ctx,
      formId: created.formId,
      definitionId: published.definitionId,
      values: { field_title: "Need keyboard" },
      selectedLabels: {}
    });

    expect(saved.revisionNumber).toBe(1);

    const saved2 = await repo.createRecordRevision({
      ctx,
      formId: created.formId,
      definitionId: published.definitionId,
      recordId: saved.recordId,
      values: { field_title: "Need monitor" },
      selectedLabels: {}
    });

    expect(saved2.revisionNumber).toBe(2);
  });
});
