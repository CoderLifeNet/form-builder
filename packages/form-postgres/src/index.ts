import { createHash } from "node:crypto";
import { Pool, PoolClient } from "pg";
import { createStableId, FormDefinition, PublishedDefinition, validateDefinition } from "@coderlifenet/form-core";
import { migrations } from "./migrations.js";

export type DbContext = {
  tenantId: string;
  actorId: string;
};

export type CreateFormInput = {
  id?: string;
  name: string;
  description?: string;
  draft: FormDefinition;
};

export type IdempotencyReplay = {
  statusCode: number;
  response: unknown;
};

export class MigrationRunner {
  constructor(private readonly pool: Pool) {}

  async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      for (const migration of migrations) {
        const applied = await client.query("SELECT id FROM schema_migrations WHERE id = $1", [migration.id]);
        if (applied.rowCount && applied.rowCount > 0) {
          continue;
        }
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export class FormRepository {
  constructor(private readonly pool: Pool) {}

  async createForm(ctx: DbContext, input: CreateFormInput): Promise<{ formId: string; draftRevision: number }> {
    const validated = validateDefinition(input.draft);
    const formId = input.id ?? createStableId("form");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
        INSERT INTO forms (id, tenant_id, name, description, created_by)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [formId, ctx.tenantId, input.name, input.description ?? null, ctx.actorId]
      );

      await client.query(
        `
        INSERT INTO form_drafts (form_id, revision, definition_json, updated_by)
        VALUES ($1, 1, $2::jsonb, $3)
      `,
        [formId, JSON.stringify(validated), ctx.actorId]
      );

      await this.insertAudit(client, ctx, "form.create", "form", formId, { name: input.name });
      await client.query("COMMIT");
      return { formId, draftRevision: 1 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getDraft(ctx: DbContext, formId: string): Promise<{ revision: number; definition: FormDefinition } | null> {
    const result = await this.pool.query(
      `
      SELECT d.revision, d.definition_json
      FROM form_drafts d
      JOIN forms f ON f.id = d.form_id
      WHERE d.form_id = $1 AND f.tenant_id = $2
    `,
      [formId, ctx.tenantId]
    );

    if (!result.rowCount) {
      return null;
    }

    return {
      revision: result.rows[0].revision,
      definition: validateDefinition(result.rows[0].definition_json)
    };
  }

  async saveDraft(
    ctx: DbContext,
    formId: string,
    expectedRevision: number,
    definition: FormDefinition
  ): Promise<{ revision: number }> {
    const validated = validateDefinition(definition);
    const result = await this.pool.query(
      `
      UPDATE form_drafts d
      SET revision = d.revision + 1,
          definition_json = $3::jsonb,
          updated_by = $4,
          updated_at = NOW()
      FROM forms f
      WHERE d.form_id = f.id
        AND d.form_id = $1
        AND f.tenant_id = $2
        AND d.revision = $5
      RETURNING d.revision
    `,
      [formId, ctx.tenantId, JSON.stringify(validated), ctx.actorId, expectedRevision]
    );

    if (!result.rowCount) {
      throw new Error("DRAFT_CONFLICT");
    }

    return { revision: result.rows[0].revision };
  }

  async publishDraft(
    ctx: DbContext,
    formId: string,
    expectedDraftRevision: number
  ): Promise<{ definitionId: string; publicationVersion: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const draftRes = await client.query(
        `
        SELECT d.definition_json, d.revision
        FROM form_drafts d
        JOIN forms f ON f.id = d.form_id
        WHERE d.form_id = $1
          AND f.tenant_id = $2
        FOR UPDATE
      `,
        [formId, ctx.tenantId]
      );
      if (!draftRes.rowCount) {
        throw new Error("FORM_NOT_FOUND");
      }
      const draft = draftRes.rows[0];
      if (draft.revision !== expectedDraftRevision) {
        throw new Error("DRAFT_CONFLICT");
      }

      const versionRes = await client.query(
        "SELECT COALESCE(MAX(publication_version), 0) AS max_version FROM published_definitions WHERE form_id = $1",
        [formId]
      );
      const publicationVersion = Number(versionRes.rows[0].max_version) + 1;
      const definitionId = createStableId("definition");
      const parsed = validateDefinition(draft.definition_json);
      const published: PublishedDefinition = {
        ...parsed,
        publicationVersion,
        publishedAt: new Date().toISOString()
      };

      await client.query(
        `
        INSERT INTO published_definitions (id, form_id, publication_version, definition_json, published_by)
        VALUES ($1, $2, $3, $4::jsonb, $5)
      `,
        [definitionId, formId, publicationVersion, JSON.stringify(published), ctx.actorId]
      );

      await this.insertAudit(client, ctx, "form.publish", "form", formId, { publicationVersion, definitionId });
      await client.query("COMMIT");

      return { definitionId, publicationVersion };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async withIdempotency(
    ctx: DbContext,
    operation: string,
    idempotencyKey: string,
    payload: unknown,
    handler: () => Promise<{ statusCode: number; response: unknown }>
  ): Promise<IdempotencyReplay> {
    const requestHash = hashPayload(payload);
    const existing = await this.pool.query(
      `
      SELECT request_hash, status_code, response_json
      FROM idempotency_keys
      WHERE tenant_id = $1
        AND operation = $2
        AND key_value = $3
        AND expires_at > NOW()
    `,
      [ctx.tenantId, operation, idempotencyKey]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const row = existing.rows[0];
      if (row.request_hash !== requestHash) {
        throw new Error("IDEMPOTENCY_PAYLOAD_MISMATCH");
      }
      return { statusCode: row.status_code, response: row.response_json };
    }

    const outcome = await handler();

    await this.pool.query(
      `
      INSERT INTO idempotency_keys (id, tenant_id, operation, key_value, request_hash, response_json, status_code, created_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW() + INTERVAL '24 hours')
      ON CONFLICT (tenant_id, operation, key_value)
      DO NOTHING
    `,
      [
        createStableId("idem"),
        ctx.tenantId,
        operation,
        idempotencyKey,
        requestHash,
        JSON.stringify(outcome.response),
        outcome.statusCode,
        ctx.actorId
      ]
    );

    return outcome;
  }

  async createRecordRevision(input: {
    ctx: DbContext;
    formId: string;
    definitionId: string;
    recordId?: string;
    values: Record<string, unknown>;
    selectedLabels: Record<string, string>;
  }): Promise<{ recordId: string; revisionId: string; revisionNumber: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const recordId = input.recordId ?? createStableId("record");

      let revisionNumber = 1;
      if (!input.recordId) {
        await client.query(
          `
          INSERT INTO records (id, tenant_id, form_id, created_by)
          VALUES ($1, $2, $3, $4)
        `,
          [recordId, input.ctx.tenantId, input.formId, input.ctx.actorId]
        );
      } else {
        const lock = await client.query(
          `
          SELECT id
          FROM records
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE
        `,
          [recordId, input.ctx.tenantId]
        );
        if (!lock.rowCount) {
          throw new Error("RECORD_NOT_FOUND");
        }

        const latest = await client.query(
          `
          SELECT COALESCE(MAX(revision_number), 0) AS max_revision
          FROM record_revisions rr
          WHERE rr.record_id = $1
        `,
          [recordId]
        );
        revisionNumber = Number(latest.rows[0].max_revision) + 1;
      }

      const revisionId = createStableId("revision");
      await client.query(
        `
        INSERT INTO record_revisions (
          id, record_id, revision_number, definition_id, values_json, selected_labels_json, created_by
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
      `,
        [
          revisionId,
          recordId,
          revisionNumber,
          input.definitionId,
          JSON.stringify(input.values),
          JSON.stringify(input.selectedLabels),
          input.ctx.actorId
        ]
      );

      await client.query(
        `
        UPDATE records
        SET current_revision_id = $1, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
      `,
        [revisionId, recordId, input.ctx.tenantId]
      );

      await this.insertAudit(client, input.ctx, "record.save", "record", recordId, {
        revisionId,
        revisionNumber
      });

      await client.query("COMMIT");
      return { recordId, revisionId, revisionNumber };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertAudit(
    client: PoolClient,
    ctx: DbContext,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO audit_events (id, tenant_id, actor_id, action, target_type, target_id, metadata_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
      [createStableId("audit"), ctx.tenantId, ctx.actorId, action, targetType, targetId, JSON.stringify(metadata)]
    );
  }
}

export function makePool(connectionString = process.env.FORM_DB_URL): Pool {
  if (!connectionString) {
    throw new Error("FORM_DB_URL is required");
  }
  return new Pool({ connectionString });
}

function hashPayload(payload: unknown): string {
  const raw = JSON.stringify(payload);
  return createHash("sha256").update(raw).digest("hex");
}
