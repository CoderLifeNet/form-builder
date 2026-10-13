import { expect, test } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:4011";

const starterDefinition = {
  metadata: {
    formId: "workspace-seeded",
    name: "Workspace seeded form",
    schemaVersion: "1.0.0"
  },
  sections: [
    { id: "s1", title: "Details", order: 0 },
    { id: "s2", title: "Follow-up", order: 1 }
  ],
  fields: [
    { id: "field_title", key: "field_title", type: "text", label: "Title", sectionId: "s1", row: 0, width: 12, required: true, rules: [] },
    { id: "field_category", key: "field_category", type: "single_select", label: "Category", sectionId: "s1", row: 1, width: 12, required: false, options: [{ id: "equipment", label: "Equipment" }], rules: [] },
    { id: "field_follow_up", key: "field_follow_up", type: "multiline", label: "Follow-up details", sectionId: "s2", row: 0, width: 12, required: false, rules: [] }
  ],
  dependencyVersions: {}
};

test("workspace reference host supports persisted submissions, read-only rendering, and version discovery", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Connected as owner1")).toBeVisible();

  const seeded = await page.evaluate(async ({ definition, apiBaseUrl }) => {
    const requestJson = async (input: string, init?: RequestInit) => {
      const response = await fetch(input, init);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(`Seed request failed (${response.status}) for ${input}: ${JSON.stringify(body)}`);
      }
      return body as Record<string, unknown>;
    };

    const suffix = Date.now();

    await requestJson(`${apiBaseUrl}/dev/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "owner1", tenantId: "tenant_alpha" })
    });

    const formName = `Seeded form ${suffix}`;
    const created = await requestJson(`${apiBaseUrl}/api/forms`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: formName,
        description: "Seeded for workspace browser flow",
        definition
      })
    });

    const publishedV1 = await requestJson(`${apiBaseUrl}/api/forms/${created.formId}/publish`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision: created.draftRevision })
    });

    const ownerSubmissionBody = await requestJson(`${apiBaseUrl}/api/records`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": `seed_owner_${Date.now()}` },
      body: JSON.stringify({
        formId: created.formId,
        definitionId: publishedV1.definitionId,
        values: {
          field_title: "Owner seeded record",
          field_category: "equipment"
        }
      })
    });

    await requestJson(`${apiBaseUrl}/dev/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "collab1", tenantId: "tenant_alpha" })
    });

    const collabSubmissionBody = await requestJson(`${apiBaseUrl}/api/records`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "idempotency-key": `seed_collab_${Date.now()}` },
      body: JSON.stringify({
        formId: created.formId,
        definitionId: publishedV1.definitionId,
        values: {
          field_title: "Collaborator seeded record",
          field_category: "equipment",
          field_follow_up: "Details for v1"
        }
      })
    });

    await requestJson(`${apiBaseUrl}/dev/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "owner1", tenantId: "tenant_alpha" })
    });

    const draft = await requestJson(`${apiBaseUrl}/api/forms/${created.formId}/draft`, {
      method: "GET",
      credentials: "include"
    });

    const nextDefinition = {
      ...(draft.definition as Record<string, unknown>),
      fields: [
        ...((draft.definition as { fields: Array<Record<string, unknown>> }).fields),
        {
          id: "field_extra",
          key: "field_extra",
          type: "text",
          label: "Added in v2",
          sectionId: "s2",
          row: 1,
          width: 12,
          required: false,
          rules: []
        }
      ]
    };

    const savedDraft = await requestJson(`${apiBaseUrl}/api/forms/${created.formId}/draft`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision: draft.revision, definition: nextDefinition })
    });

    const publishedV2 = await requestJson(`${apiBaseUrl}/api/forms/${created.formId}/publish`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision: savedDraft.revision })
    });

    return {
      formName,
      ownerRecordId: String(ownerSubmissionBody.recordId),
      collabRecordId: String(collabSubmissionBody.recordId),
      version1: Number(publishedV1.publicationVersion),
      version2: Number(publishedV2.publicationVersion)
    };
  }, { definition: starterDefinition, apiBaseUrl });

  await page.reload();
  await expect(page.getByText("Connected as owner1")).toBeVisible();
  await page.getByRole("button", { name: "Manager", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Forms" })).toBeVisible();
  await page.getByRole("button", { name: seeded.formName }).click();
  await page.getByRole("button", { name: "Manager", exact: true }).click();

  await page.getByRole("button", { name: "Submissions", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByText(seeded.ownerRecordId)).toBeVisible();
  await expect(page.getByText(seeded.collabRecordId)).toBeVisible();

  const firstCardId = await page.locator("[data-testid^='submission-']").first().getAttribute("data-testid");
  expect(firstCardId).not.toBe(`submission-${seeded.ownerRecordId}`);

  const ownerRow = page.getByTestId(`submission-${seeded.ownerRecordId}`);

  await ownerRow.getByRole("button", { name: "Read only", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Read-only rendering" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Owner seeded record");

  await page.getByRole("button", { name: "Submissions", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();

  await page.getByTestId(`submission-${seeded.ownerRecordId}`).getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Revision history" })).toBeVisible();
  await page.getByRole("button", { name: "Edit latest record", exact: true }).click();
  await page.getByLabel("Title").fill("Owner edited title via history");
  await page.getByRole("button", { name: "Submit", exact: true }).click();

  await page.getByRole("button", { name: "Submissions", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();

  await page.getByTestId(`submission-${seeded.collabRecordId}`).getByRole("button", { name: "Read only", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Read-only rendering" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Collaborator seeded record");

  await page.getByRole("button", { name: "Submissions", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.getByTestId(`submission-${seeded.ownerRecordId}`).getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Revision history" })).toBeVisible();
  await expect(page.getByText("Owner edited title via history")).toBeVisible();

  await page.getByRole("button", { name: "Submissions", exact: true }).click();
  await page.reload();
  await expect(page.getByText("Connected as owner1")).toBeVisible();
  await page.getByRole("button", { name: seeded.formName, exact: true }).click();
  await page.getByRole("button", { name: "Submissions", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByText(seeded.ownerRecordId)).toBeVisible();
  await expect(page.getByText(seeded.collabRecordId)).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Published versions" })).toBeVisible();
  await page.getByRole("combobox", { name: "Version" }).click();
  await page.getByRole("option", { name: new RegExp(`^v${seeded.version1}\\b`) }).click();
  await page.getByRole("button", { name: "Open selected version read only", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Read-only rendering" })).toBeVisible();
  await expect(page.getByLabel("Added in v2")).toHaveCount(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Version" }).click();
  await page.getByRole("option", { name: new RegExp(`^v${seeded.version2}\\b`) }).click();
  await page.getByRole("button", { name: "Open selected version read only", exact: true }).click();
  await expect(page.getByLabel("Added in v2")).toBeVisible();
});
