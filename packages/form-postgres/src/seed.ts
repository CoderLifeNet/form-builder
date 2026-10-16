import { makePool, FormRepository } from "./index.js";
import { createStableId } from "@coderlifenet/form-core";
import type { FormDefinition } from "@coderlifenet/form-core";

const demoDefinition: FormDefinition = {
  metadata: {
    formId: "demo-service-request",
    name: "Service request",
    description: "Workspace sample form",
    schemaVersion: "1.0.0"
  },
  sections: [
    { id: "section_details", title: "Your details", order: 0 },
    { id: "section_request", title: "Request", order: 1 }
  ],
  fields: [
    {
      id: "field_first_name",
      key: "first_name",
      type: "text",
      label: "First name",
      required: true,
      sectionId: "section_details",
      row: 0,
      width: 6,
      source: { id: "profile.first_name", version: "1", mode: "display_only" },
      rules: []
    },
    {
      id: "field_last_name",
      key: "last_name",
      type: "text",
      label: "Last name",
      required: true,
      sectionId: "section_details",
      row: 0,
      width: 6,
      source: { id: "profile.last_name", version: "1", mode: "display_only" },
      rules: []
    },
    {
      id: "field_title",
      key: "title",
      type: "text",
      label: "Request title",
      required: true,
      sectionId: "section_request",
      row: 0,
      width: 12,
      rules: [],
      validation: { minLength: 4 }
    }
  ],
  dependencyVersions: {
    "profile.first_name": "1",
    "profile.last_name": "1"
  }
};

async function main(): Promise<void> {
  const pool = makePool();
  const repo = new FormRepository(pool);

  const ctx = {
    tenantId: "tenant_demo",
    actorId: "seed_runner"
  };

  try {
    const name = `Service request seeded ${new Date().toISOString()}`;
    const created = await repo.createForm(ctx, {
      id: createStableId("form"),
      name,
      description: "Seeded sample",
      draft: demoDefinition
    });

    await repo.publishDraft(ctx, created.formId, created.draftRevision);
    // eslint-disable-next-line no-console
    console.log(`Seeded form ${created.formId}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
