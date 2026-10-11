export type Migration = {
  id: string;
  sql: string;
};

export const migrations: Migration[] = [
  {
    id: "0001_initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, name)
      );

      CREATE TABLE IF NOT EXISTS form_drafts (
        form_id TEXT PRIMARY KEY REFERENCES forms(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        definition_json JSONB NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS published_definitions (
        id TEXT PRIMARY KEY,
        form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        publication_version INTEGER NOT NULL,
        definition_json JSONB NOT NULL,
        published_by TEXT NOT NULL,
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (form_id, publication_version)
      );

      CREATE TABLE IF NOT EXISTS form_bindings (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        policy_json JSONB NOT NULL,
        resolved_definition_id TEXT NOT NULL REFERENCES published_definitions(id),
        updated_by TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, scope_type, scope_id)
      );

      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,
        current_revision_id TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS record_revisions (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        revision_number INTEGER NOT NULL,
        definition_id TEXT NOT NULL REFERENCES published_definitions(id),
        values_json JSONB NOT NULL,
        selected_labels_json JSONB NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (record_id, revision_number)
      );

      CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,
        object_key TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        status TEXT NOT NULL,
        attached_revision_id TEXT REFERENCES record_revisions(id),
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        key_value TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        response_json JSONB NOT NULL,
        status_code INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        UNIQUE (tenant_id, operation, key_value)
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        metadata_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_forms_tenant ON forms(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_records_tenant_form ON records(tenant_id, form_id);
      CREATE INDEX IF NOT EXISTS idx_revisions_record ON record_revisions(record_id, revision_number DESC);
      CREATE INDEX IF NOT EXISTS idx_uploads_tenant_status ON uploads(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(expires_at);
    `
  }
];
