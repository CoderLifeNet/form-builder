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
      await client.query("SELECT pg_advisory_xact_lock(hashtext('formbuilder_migrate_lock'))");
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

  async status(): Promise<{ applied: string[]; pending: string[] }> {
    const result = await this.pool.query("SELECT id FROM schema_migrations ORDER BY id ASC");
    const applied = new Set<string>(result.rows.map((row) => String(row.id)));
    const all = migrations.map((migration) => migration.id);
    return {
      applied: all.filter((id) => applied.has(id)),
      pending: all.filter((id) => !applied.has(id))
    };
  }
}

export class FormRepository {
  constructor(private readonly pool: Pool) {}

  async listForms(ctx: DbContext, options?: { includeArchived?: boolean }): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    archived: boolean;
    draftRevision: number | null;
    publishedVersion: number | null;
    publishedDefinitionId: string | null;
  }>> {
    const includeArchived = options?.includeArchived ?? false;
    const result = await this.pool.query(
      `
      SELECT
        f.id,
        f.name,
        f.description,
        f.archived,
        d.revision AS draft_revision,
        pd.publication_version AS published_version,
        pd.id AS published_definition_id
      FROM forms f
      LEFT JOIN form_drafts d ON d.form_id = f.id
      LEFT JOIN LATERAL (
        SELECT id, publication_version
        FROM published_definitions p
        WHERE p.form_id = f.id
        ORDER BY publication_version DESC
        LIMIT 1
      ) pd ON true
      WHERE f.tenant_id = $1
        AND ($2::boolean = true OR f.archived = false)
      ORDER BY f.updated_at DESC, f.created_at DESC
    `,
      [ctx.tenantId, includeArchived]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      archived: Boolean(row.archived),
      draftRevision: row.draft_revision === null ? null : Number(row.draft_revision),
      publishedVersion: row.published_version === null ? null : Number(row.published_version),
      publishedDefinitionId: row.published_definition_id
    }));
  }

  async getFormById(ctx: DbContext, formId: string): Promise<{
    id: string;
    name: string;
    description: string | null;
    archived: boolean;
    draftRevision: number | null;
    publishedVersion: number | null;
    publishedDefinitionId: string | null;
  } | null> {
    const result = await this.pool.query(
      `
      SELECT
        f.id,
        f.name,
        f.description,
        f.archived,
        d.revision AS draft_revision,
        pd.publication_version AS published_version,
        pd.id AS published_definition_id
      FROM forms f
      LEFT JOIN form_drafts d ON d.form_id = f.id
      LEFT JOIN LATERAL (
        SELECT id, publication_version
        FROM published_definitions p
        WHERE p.form_id = f.id
        ORDER BY publication_version DESC
        LIMIT 1
      ) pd ON true
      WHERE f.tenant_id = $1
        AND f.id = $2
      LIMIT 1
    `,
      [ctx.tenantId, formId]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      archived: Boolean(row.archived),
      draftRevision: row.draft_revision === null ? null : Number(row.draft_revision),
      publishedVersion: row.published_version === null ? null : Number(row.published_version),
      publishedDefinitionId: row.published_definition_id
    };
  }

  async getPublishedDefinitionById(ctx: DbContext, definitionId: string): Promise<{
    id: string;
    formId: string;
    publicationVersion: number;
    definition: PublishedDefinition;
  } | null> {
    const result = await this.pool.query(
      `
      SELECT p.id, p.form_id, p.publication_version, p.definition_json
      FROM published_definitions p
      JOIN forms f ON f.id = p.form_id
      WHERE p.id = $1
        AND f.tenant_id = $2
      LIMIT 1
    `,
      [definitionId, ctx.tenantId]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      formId: row.form_id,
      publicationVersion: Number(row.publication_version),
      definition: row.definition_json as PublishedDefinition
    };
  }

  async getLatestPublishedDefinitionByForm(ctx: DbContext, formId: string): Promise<{
    id: string;
    formId: string;
    publicationVersion: number;
    definition: PublishedDefinition;
  } | null> {
    const result = await this.pool.query(
      `
      SELECT p.id, p.form_id, p.publication_version, p.definition_json
      FROM published_definitions p
      JOIN forms f ON f.id = p.form_id
      WHERE p.form_id = $1
        AND f.tenant_id = $2
      ORDER BY p.publication_version DESC
      LIMIT 1
    `,
      [formId, ctx.tenantId]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      formId: row.form_id,
      publicationVersion: Number(row.publication_version),
      definition: row.definition_json as PublishedDefinition
    };
  }

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
    uploadIds?: string[];
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

      if (input.uploadIds && input.uploadIds.length > 0) {
        const attach = await client.query(
          `
          UPDATE uploads
          SET status = 'attached',
              attached_revision_id = $1,
              updated_at = NOW()
          WHERE id = ANY($2::text[])
            AND tenant_id = $3
            AND status = 'completed'
          RETURNING id
        `,
          [revisionId, input.uploadIds, input.ctx.tenantId]
        );

        if (attach.rowCount !== input.uploadIds.length) {
          throw new Error("UPLOAD_ATTACH_CONFLICT");
        }
      }

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

  async createUpload(input: {
    ctx: DbContext;
    formId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    objectKey: string;
  }): Promise<{ uploadId: string }> {
    const uploadId = createStableId("upload");
    await this.pool.query(
      `
      INSERT INTO uploads (id, tenant_id, form_id, object_key, file_name, content_type, size_bytes, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8)
    `,
      [
        uploadId,
        input.ctx.tenantId,
        input.formId,
        input.objectKey,
        input.fileName,
        input.contentType,
        input.sizeBytes,
        input.ctx.actorId
      ]
    );

    await this.pool.query(
      `
      INSERT INTO audit_events (id, tenant_id, actor_id, action, target_type, target_id, metadata_json)
      VALUES ($1, $2, $3, 'upload.create', 'upload', $4, $5::jsonb)
    `,
      [
        createStableId("audit"),
        input.ctx.tenantId,
        input.ctx.actorId,
        uploadId,
        JSON.stringify({ formId: input.formId, fileName: input.fileName, sizeBytes: input.sizeBytes })
      ]
    );

    return { uploadId };
  }

  async getUploadById(ctx: DbContext, uploadId: string): Promise<{
    id: string;
    tenantId: string;
    formId: string;
    objectKey: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    status: string;
    attachedRevisionId: string | null;
  } | null> {
    const result = await this.pool.query(
      `
      SELECT id, tenant_id, form_id, object_key, file_name, content_type, size_bytes, status, attached_revision_id
      FROM uploads
      WHERE id = $1
        AND tenant_id = $2
    `,
      [uploadId, ctx.tenantId]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      formId: row.form_id,
      objectKey: row.object_key,
      fileName: row.file_name,
      contentType: row.content_type,
      sizeBytes: Number(row.size_bytes),
      status: row.status,
      attachedRevisionId: row.attached_revision_id
    };
  }

  async markUploadDeletionPending(ctx: DbContext, uploadId: string): Promise<void> {
    const result = await this.pool.query(
      `
      UPDATE uploads
      SET status = 'deletion_pending', updated_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
      RETURNING id
    `,
      [uploadId, ctx.tenantId]
    );

    if (!result.rowCount) {
      throw new Error("UPLOAD_NOT_FOUND");
    }
  }

  async deleteUploadRow(ctx: DbContext, uploadId: string): Promise<void> {
    await this.pool.query(
      `
      DELETE FROM uploads
      WHERE id = $1
        AND tenant_id = $2
    `,
      [uploadId, ctx.tenantId]
    );
  }

  async listRecordRevisions(ctx: DbContext, recordId: string): Promise<Array<{
    id: string;
    revisionNumber: number;
    definitionId: string;
    values: Record<string, unknown>;
    createdAt: string;
  }>> {
    const result = await this.pool.query(
      `
      SELECT rr.id, rr.revision_number, rr.definition_id, rr.values_json, rr.created_at
      FROM record_revisions rr
      JOIN records r ON r.id = rr.record_id
      WHERE rr.record_id = $1
        AND r.tenant_id = $2
      ORDER BY rr.revision_number DESC
    `,
      [recordId, ctx.tenantId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      revisionNumber: Number(row.revision_number),
      definitionId: row.definition_id,
      values: row.values_json as Record<string, unknown>,
      createdAt: row.created_at.toISOString()
    }));
  }

  async archiveForm(ctx: DbContext, formId: string, archived: boolean): Promise<void> {
    const result = await this.pool.query(
      `
      UPDATE forms
      SET archived = $3,
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
      RETURNING id
    `,
      [ctx.tenantId, formId, archived]
    );

    if (!result.rowCount) {
      throw new Error("FORM_NOT_FOUND");
    }
  }

  async deleteRecordAndRevisions(ctx: DbContext, recordId: string): Promise<{ objectKeys: string[] }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const record = await client.query(
        `
        SELECT id
        FROM records
        WHERE id = $1
          AND tenant_id = $2
        FOR UPDATE
      `,
        [recordId, ctx.tenantId]
      );

      if (!record.rowCount) {
        throw new Error("RECORD_NOT_FOUND");
      }

      const uploads = await client.query(
        `
        SELECT u.object_key
        FROM uploads u
        JOIN record_revisions rr ON rr.id = u.attached_revision_id
        WHERE rr.record_id = $1
          AND u.tenant_id = $2
      `,
        [recordId, ctx.tenantId]
      );

      await client.query(
        `
        DELETE FROM uploads u
        USING record_revisions rr
        WHERE u.attached_revision_id = rr.id
          AND rr.record_id = $1
          AND u.tenant_id = $2
      `,
        [recordId, ctx.tenantId]
      );

      await client.query(
        `
        DELETE FROM records
        WHERE id = $1
          AND tenant_id = $2
      `,
        [recordId, ctx.tenantId]
      );

      await this.insertAudit(client, ctx, "record.erase", "record", recordId, {});
      await client.query("COMMIT");

      return {
        objectKeys: uploads.rows.map((row) => String(row.object_key))
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
