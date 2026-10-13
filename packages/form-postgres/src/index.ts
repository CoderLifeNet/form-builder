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

export type RecordSummary = {
  recordId: string;
  formId: string;
  formName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  currentRevisionId: string | null;
  currentRevisionNumber: number | null;
  currentDefinitionId: string | null;
};

export type RecordListFilters = {
  formId?: string;
  createdBy?: string;
  createdFrom?: string;
  createdTo?: string;
  query?: string;
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

  async getPublishedDefinitionById(ctx: DbContext, definitionId: string, transactionClient?: PoolClient): Promise<{
    id: string;
    formId: string;
    publicationVersion: number;
    definition: PublishedDefinition;
  } | null> {
    const result = await (transactionClient ?? this.pool).query(
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

  async listPublishedDefinitionsByForm(ctx: DbContext, formId: string): Promise<Array<{
    id: string;
    formId: string;
    publicationVersion: number;
    publishedAt: string;
    fieldCount: number;
    name: string;
  }>> {
    const result = await this.pool.query(
      `
      SELECT p.id, p.form_id, p.publication_version, p.definition_json
      FROM published_definitions p
      JOIN forms f ON f.id = p.form_id
      WHERE p.form_id = $1
        AND f.tenant_id = $2
      ORDER BY p.publication_version DESC
      `,
      [formId, ctx.tenantId]
    );

    return result.rows.map((row) => {
      const definition = row.definition_json as PublishedDefinition;
      return {
        id: row.id,
        formId: row.form_id,
        publicationVersion: Number(row.publication_version),
        publishedAt: String(definition.publishedAt),
        fieldCount: definition.fields.length,
        name: definition.metadata.name
      };
    });
  }

  async getPublishedDefinitionByVersion(ctx: DbContext, formId: string, publicationVersion: number): Promise<{
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
        AND p.publication_version = $2
        AND f.tenant_id = $3
      LIMIT 1
      `,
      [formId, publicationVersion, ctx.tenantId]
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
    handler: (client: PoolClient) => Promise<{ statusCode: number; response: unknown }>
  ): Promise<IdempotencyReplay> {
    const requestHash = hashPayload(payload);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize identical keys across processes, and commit mutation + replay together.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [JSON.stringify([ctx.tenantId, operation, idempotencyKey])]);
      await client.query("DELETE FROM idempotency_keys WHERE tenant_id=$1 AND operation=$2 AND key_value=$3 AND expires_at <= NOW()", [ctx.tenantId, operation, idempotencyKey]);
      const existing = await client.query("SELECT request_hash, status_code, response_json, created_by FROM idempotency_keys WHERE tenant_id=$1 AND operation=$2 AND key_value=$3", [ctx.tenantId, operation, idempotencyKey]);
      if (existing.rowCount) {
        const row = existing.rows[0];
        if (row.created_by !== ctx.actorId) throw new Error("FORBIDDEN");
        if (row.request_hash !== requestHash) throw new Error("IDEMPOTENCY_PAYLOAD_MISMATCH");
        await client.query("COMMIT");
        return { statusCode: row.status_code, response: row.response_json };
      }
      const outcome = await handler(client);
      await client.query(`INSERT INTO idempotency_keys (id,tenant_id,operation,key_value,request_hash,response_json,status_code,created_by,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NOW()+INTERVAL '24 hours')`, [createStableId("idem"),ctx.tenantId,operation,idempotencyKey,requestHash,JSON.stringify(outcome.response),outcome.statusCode,ctx.actorId]);
      await client.query("COMMIT");
      return outcome;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async createRecordRevision(input: {
    ctx: DbContext;
    formId: string;
    definitionId: string;
    recordId?: string;
    values: Record<string, unknown>;
    selectedLabels: Record<string, string>;
    uploadIds?: string[];
    expectedRevision?: number;
    transactionClient?: PoolClient;
    explicitMigration?: boolean;
  }): Promise<{ recordId: string; revisionId: string; revisionNumber: number }> {
    const ownTransaction = !input.transactionClient;
    const client = input.transactionClient ?? await this.pool.connect();
    try {
      if (ownTransaction) await client.query("BEGIN");
      const publication = await client.query("SELECT p.form_id FROM published_definitions p JOIN forms f ON f.id=p.form_id WHERE p.id=$1 AND f.tenant_id=$2", [input.definitionId,input.ctx.tenantId]);
      if (!publication.rowCount || publication.rows[0].form_id !== input.formId) throw new Error("DEFINITION_NOT_FOUND");
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
          SELECT id, form_id
          FROM records
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE
        `,
          [recordId, input.ctx.tenantId]
        );
        if (!lock.rowCount) {
          throw new Error("RECORD_NOT_FOUND");
        }

        if (lock.rows[0].form_id !== input.formId) throw new Error("RECORD_FORM_CONFLICT");
        const latestDefinition = await client.query("SELECT definition_id FROM record_revisions WHERE record_id=$1 ORDER BY revision_number DESC LIMIT 1", [recordId]);
        if (!input.explicitMigration && latestDefinition.rows[0]?.definition_id !== input.definitionId) throw new Error("RECORD_DEFINITION_CONFLICT");

        const latest = await client.query(
          `
          SELECT COALESCE(MAX(revision_number), 0) AS max_revision
          FROM record_revisions rr
          WHERE rr.record_id = $1
        `,
          [recordId]
        );
        const currentRevisionNumber = Number(latest.rows[0].max_revision);
        if (input.expectedRevision !== undefined && currentRevisionNumber !== input.expectedRevision) {
          throw new Error("RECORD_CONFLICT");
        }
        revisionNumber = currentRevisionNumber + 1;
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
        const uploads = await client.query(
          `
          SELECT u.id, u.status, u.attached_revision_id,
                 rr.record_id AS attached_record_id
          FROM uploads u
          LEFT JOIN record_revisions rr ON rr.id = u.attached_revision_id
          WHERE u.id = ANY($1::text[])
            AND u.tenant_id = $2
            AND u.form_id = $3
          `,
          [input.uploadIds, input.ctx.tenantId, input.formId]
        );

        const uploadById = new Map<string, { status: string; attachedRevisionId: string | null; attachedRecordId: string | null }>();
        for (const row of uploads.rows) {
          uploadById.set(String(row.id), {
            status: String(row.status),
            attachedRevisionId: row.attached_revision_id ? String(row.attached_revision_id) : null,
            attachedRecordId: row.attached_record_id ? String(row.attached_record_id) : null
          });
        }

        const toAttach: string[] = [];
        for (const uploadId of input.uploadIds) {
          const found = uploadById.get(uploadId);
          if (!found) {
            throw new Error("UPLOAD_ATTACH_CONFLICT");
          }
          if (found.status === "completed" && !found.attachedRevisionId) {
            toAttach.push(uploadId);
            continue;
          }
          if (found.attachedRevisionId && found.attachedRecordId === recordId) {
            continue;
          }
          throw new Error("UPLOAD_ATTACH_CONFLICT");
        }

        if (toAttach.length > 0) {
          const attach = await client.query(
            `
            UPDATE uploads
            SET status = 'attached',
                attached_revision_id = $1,
                updated_at = NOW()
            WHERE id = ANY($2::text[])
              AND tenant_id = $3
              AND status = 'completed'
              AND form_id = $4
            RETURNING id
            `,
            [revisionId, toAttach, input.ctx.tenantId, input.formId]
          );

          if (attach.rowCount !== toAttach.length) {
            throw new Error("UPLOAD_ATTACH_CONFLICT");
          }
        }
      }

      await this.insertAudit(client, input.ctx, "record.save", "record", recordId, {
        revisionId,
        revisionNumber
      });

      if (ownTransaction) await client.query("COMMIT");
      return { recordId, revisionId, revisionNumber };
    } catch (error) {
      if (ownTransaction) await client.query("ROLLBACK");
      throw error;
    } finally {
      if (ownTransaction) client.release();
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
        JSON.stringify({ formId: input.formId, sizeBytes: input.sizeBytes })
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
    createdBy: string;
    attachedRevisionId: string | null;
    attachedRecordId: string | null;
  } | null> {
    const result = await this.pool.query(
      `
      SELECT u.id,
             u.tenant_id,
             u.form_id,
             u.object_key,
             u.file_name,
             u.content_type,
             u.size_bytes,
             u.status,
             u.created_by,
             u.attached_revision_id,
             rr.record_id AS attached_record_id
      FROM uploads u
      LEFT JOIN record_revisions rr ON rr.id = u.attached_revision_id
      WHERE u.id = $1
        AND u.tenant_id = $2
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
      createdBy: String(row.created_by),
      attachedRevisionId: row.attached_revision_id,
      attachedRecordId: row.attached_record_id ? String(row.attached_record_id) : null
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

  async saveBinding(ctx: DbContext, scope: { type: string; id: string }, input: { formId: string; mode: "latest" | "pinned"; definitionId?: string; expectedRevision: number }): Promise<{ revision: number }> {
    const definition = input.mode === "pinned"
      ? await this.getPublishedDefinitionById(ctx, input.definitionId ?? "")
      : (await this.pool.query(`SELECT pd.id, pd.form_id AS "formId" FROM published_definitions pd JOIN forms f ON f.id = pd.form_id WHERE f.tenant_id = $1 AND f.id = $2 ORDER BY pd.publication_version DESC LIMIT 1`, [ctx.tenantId, input.formId])).rows[0];
    if (!definition || definition.formId !== input.formId) throw new Error("DEFINITION_NOT_FOUND");
    const parameters = [ctx.tenantId, scope.type, scope.id, input.formId, JSON.stringify({ mode: input.mode }), definition.id, ctx.actorId];
    const result = input.expectedRevision === 0
      ? await this.pool.query(`INSERT INTO form_bindings (id,tenant_id,scope_type,scope_id,form_id,policy_json,resolved_definition_id,updated_by) VALUES ($8,$1,$2,$3,$4,$5::jsonb,$6,$7) ON CONFLICT (tenant_id,scope_type,scope_id) DO NOTHING RETURNING revision`, [...parameters, createStableId("binding")])
      : await this.pool.query(`UPDATE form_bindings SET form_id=$4,policy_json=$5::jsonb,resolved_definition_id=$6,updated_by=$7,updated_at=NOW(),revision=revision+1 WHERE tenant_id=$1 AND scope_type=$2 AND scope_id=$3 AND revision=$8 RETURNING revision`, [...parameters, input.expectedRevision]);
    if (!result.rowCount) throw new Error("BINDING_CONFLICT");
    return { revision: Number(result.rows[0].revision) };
  }
  async resetBinding(ctx: DbContext, scope: { type: string; id: string }, expectedRevision: number): Promise<void> {
    const result = await this.pool.query("DELETE FROM form_bindings WHERE tenant_id=$1 AND scope_type=$2 AND scope_id=$3 AND revision=$4 RETURNING id", [ctx.tenantId,scope.type,scope.id,expectedRevision]);
    if (!result.rowCount) throw new Error("BINDING_CONFLICT");
  }
  async resolveBinding(ctx: DbContext, ancestors: Array<{ type: string; id: string }>): Promise<{ source: {type:string;id:string}; revision: number; mode: "latest" | "pinned"; definitionId: string; formId: string } | null> {
    for (const scope of [...ancestors].reverse()) {
      const result = await this.pool.query("SELECT revision,policy_json,resolved_definition_id,form_id FROM form_bindings WHERE tenant_id=$1 AND scope_type=$2 AND scope_id=$3", [ctx.tenantId,scope.type,scope.id]);
      const binding = result.rows[0];
      if (!binding) continue;
      const mode = binding.policy_json.mode as "latest" | "pinned";
      let definitionId = String(binding.resolved_definition_id);
      if (mode === "latest") {
        const latest = await this.pool.query("SELECT id FROM published_definitions WHERE form_id=$1 ORDER BY publication_version DESC LIMIT 1", [binding.form_id]);
        definitionId = latest.rows[0]?.id ?? definitionId;
      }
      return { source:scope, revision:Number(binding.revision), mode, definitionId, formId:String(binding.form_id) };
    }
    return null;
  }

  async listStorageDeletions(ctx: DbContext): Promise<string[]> {
    const rows = await this.pool.query("SELECT object_key FROM storage_deletions WHERE tenant_id = $1 ORDER BY created_at LIMIT 100", [ctx.tenantId]);
    return rows.rows.map(row => String(row.object_key));
  }
  async acknowledgeStorageDeletion(ctx: DbContext, objectKey: string): Promise<void> {
    await this.pool.query("DELETE FROM storage_deletions WHERE tenant_id = $1 AND object_key = $2", [ctx.tenantId, objectKey]);
  }
  async listExpiredUploads(ctx: DbContext, maxAgeMs: number): Promise<Array<{ id: string; objectKey: string }>> {
    const rows = await this.pool.query(`SELECT id, object_key FROM uploads WHERE tenant_id = $1 AND attached_revision_id IS NULL
      AND (status = 'deletion_pending' OR created_at < NOW() - ($2 * INTERVAL '1 millisecond')) ORDER BY created_at LIMIT 100`, [ctx.tenantId, maxAgeMs]);
    return rows.rows.map(row => ({ id: String(row.id), objectKey: String(row.object_key) }));
  }

  async listRetentionEligibleRecords(
    ctx: DbContext,
    maxAgeMs: number,
    mode: "archived_forms_only" | "all_forms"
  ): Promise<string[]> {
    const rows = await this.pool.query(
      `
      SELECT r.id
      FROM records r
      JOIN forms f ON f.id = r.form_id AND f.tenant_id = r.tenant_id
      WHERE r.tenant_id = $1
        AND r.created_at < NOW() - ($2 * INTERVAL '1 millisecond')
        AND ($3::text = 'all_forms' OR f.archived = true)
      ORDER BY r.created_at ASC, r.id ASC
      LIMIT 100
      `,
      [ctx.tenantId, maxAgeMs, mode]
    );

    return rows.rows.map((row) => String(row.id));
  }

  async listRecordRevisions(ctx: DbContext, recordId: string): Promise<Array<{
    id: string;
    revisionNumber: number;
    definitionId: string;
    values: Record<string, unknown>;
    selectedLabels: Record<string, string>;
    createdAt: string;
  }>> {
    const result = await this.pool.query(
      `
      SELECT rr.id, rr.revision_number, rr.definition_id, rr.values_json, rr.selected_labels_json, rr.created_at
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
      selectedLabels: row.selected_labels_json as Record<string, string>,
      createdAt: row.created_at.toISOString()
    }));
  }

  async getRecordSummaryById(ctx: DbContext, recordId: string): Promise<RecordSummary | null> {
    const result = await this.pool.query(
      `
      SELECT r.id,
             r.form_id,
             f.name AS form_name,
             r.created_by,
             r.created_at,
              COALESCE(rr.created_at, r.created_at) AS updated_at,
             r.current_revision_id,
             rr.revision_number AS current_revision_number,
             rr.definition_id AS current_definition_id
      FROM records r
      JOIN forms f ON f.id = r.form_id AND f.tenant_id = r.tenant_id
      LEFT JOIN record_revisions rr ON rr.id = r.current_revision_id
      WHERE r.id = $1
        AND r.tenant_id = $2
      LIMIT 1
      `,
      [recordId, ctx.tenantId]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      recordId: String(row.id),
      formId: String(row.form_id),
      formName: String(row.form_name),
      createdBy: String(row.created_by),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      currentRevisionId: row.current_revision_id ? String(row.current_revision_id) : null,
      currentRevisionNumber: row.current_revision_number === null ? null : Number(row.current_revision_number),
      currentDefinitionId: row.current_definition_id ? String(row.current_definition_id) : null
    };
  }

  async listRecordSummaries(
    ctx: DbContext,
    options: { offset: number; limit: number; filters?: RecordListFilters }
  ): Promise<RecordSummary[]> {
    const filters = options.filters ?? {};
    const result = await this.pool.query(
      `
      SELECT r.id,
             r.form_id,
             f.name AS form_name,
             r.created_by,
             r.created_at,
              COALESCE(rr.created_at, r.created_at) AS updated_at,
             r.current_revision_id,
             rr.revision_number AS current_revision_number,
             rr.definition_id AS current_definition_id
      FROM records r
      JOIN forms f ON f.id = r.form_id AND f.tenant_id = r.tenant_id
      LEFT JOIN record_revisions rr ON rr.id = r.current_revision_id
      WHERE r.tenant_id = $1
        AND ($2::text IS NULL OR r.form_id = $2)
        AND ($3::text IS NULL OR r.created_by = $3)
        AND ($4::timestamptz IS NULL OR r.created_at >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR r.created_at <= $5::timestamptz)
        AND ($6::text IS NULL OR r.id ILIKE ('%' || $6 || '%') OR f.name ILIKE ('%' || $6 || '%'))
      ORDER BY r.created_at DESC, r.id DESC
      OFFSET $7
      LIMIT $8
      `,
      [
        ctx.tenantId,
        filters.formId ?? null,
        filters.createdBy ?? null,
        filters.createdFrom ?? null,
        filters.createdTo ?? null,
        filters.query ?? null,
        options.offset,
        options.limit
      ]
    );

    return result.rows.map((row) => ({
      recordId: String(row.id),
      formId: String(row.form_id),
      formName: String(row.form_name),
      createdBy: String(row.created_by),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      currentRevisionId: row.current_revision_id ? String(row.current_revision_id) : null,
      currentRevisionNumber: row.current_revision_number === null ? null : Number(row.current_revision_number),
      currentDefinitionId: row.current_definition_id ? String(row.current_definition_id) : null
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

      for (const upload of uploads.rows) {
        await client.query("INSERT INTO storage_deletions (tenant_id, object_key) VALUES ($1, $2) ON CONFLICT DO NOTHING", [ctx.tenantId, upload.object_key]);
      }

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
