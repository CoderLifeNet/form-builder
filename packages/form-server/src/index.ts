import { Readable } from "node:stream";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import morgan from "morgan";
import { compareDefinitions, createStableId, validateDefinition, ValidationError } from "@coderlifenet/form-core";
import { FormRepository, makePool } from "@coderlifenet/form-postgres";
import { z } from "zod";
import { getDevSessionContext, getDevUserCapabilities, registerDevAuthRoutes } from "./auth/dev-session.js";
import {
  applyDefinitionSources,
  exportDefinitionEnvelope,
  importDefinitionEnvelope,
  migrateRecordValuesToDefinition,
  previewRecordMigration,
  remapDefinitionStableIds,
  validateSubmissionAgainstDefinition
} from "./definition-engine.js";
import { createUploadStorageAdapterFromEnv } from "./storage/factory.js";
import type { UploadStorageAdapter } from "./storage/types.js";

export type PolicyDecision = {
  allowed: boolean;
  capabilities: string[];
};

export type AuthContext = {
  tenantId: string;
  actorId: string;
  isAnonymous: boolean;
};

export type PolicyAdapter = {
  resolveContext: (req: Request) => Promise<AuthContext>;
  authorize: (ctx: AuthContext, capability: string, resource?: Record<string, string>) => Promise<PolicyDecision>;
};

export type SourceRegistry = {
  resolveSourceValue: (
    sourceId: string,
    ctx: AuthContext,
    payload: Record<string, unknown>
  ) => Promise<unknown>;
};

const saveDraftSchema = z.object({
  expectedRevision: z.number().int().positive(),
  definition: z.unknown()
});

const createFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  definition: z.unknown()
});

const publishSchema = z.object({
  expectedRevision: z.number().int().positive()
});

const saveRecordSchema = z.object({
  formId: z.string().min(1),
  definitionId: z.string().min(1),
  recordId: z.string().optional(),
  values: z.record(z.string(), z.unknown()),
  uploadIds: z.array(z.string()).default([])
});

const importAsNewSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  envelope: z.unknown()
});

const importReplaceSchema = z.object({
  expectedRevision: z.number().int().positive(),
  envelope: z.unknown()
});

const recordMigrationSchema = z.object({
  targetDefinitionId: z.string().min(1)
});

export function createDefaultPolicyAdapter(): PolicyAdapter {
  return {
    async resolveContext(req): Promise<AuthContext> {
      if (process.env.FORM_DEV_AUTH === "true") {
        const session = getDevSessionContext(req);
        if (session) {
          return session;
        }
      }

      if (process.env.FORM_DEV_ALLOW_HEADER_CONTEXT === "true") {
        const tenantId = req.header("x-tenant-id") ?? "tenant_demo";
        const actorId = req.header("x-actor-id") ?? "anonymous";
        return {
          tenantId,
          actorId,
          isAnonymous: actorId === "anonymous"
        };
      }

      return {
        tenantId: "",
        actorId: "anonymous",
        isAnonymous: true
      };
    },

    async authorize(ctx, capability): Promise<PolicyDecision> {
      if (ctx.isAnonymous) {
        const allowAnonymousSubmit = process.env.FORM_ALLOW_ANON_SUBMIT === "true";
        const allowed = allowAnonymousSubmit && capability === "forms.submit";
        return { allowed, capabilities: allowed ? ["forms.submit"] : [] };
      }

      if (process.env.FORM_DEV_AUTH === "true") {
        const capabilities = getDevUserCapabilities(ctx.actorId, ctx.tenantId);
        return {
          allowed: capabilities.includes(capability),
          capabilities
        };
      }

      return { allowed: false, capabilities: [] };
    }
  };
}

export function createDefaultSourceRegistry(): SourceRegistry {
  return {
    async resolveSourceValue(sourceId): Promise<unknown> {
      throw new Error(`SOURCE_NOT_REGISTERED:${sourceId}`);
    }
  };
}

export function createFormServer(options?: {
  policyAdapter?: PolicyAdapter;
  sourceRegistry?: SourceRegistry;
  repository?: FormRepository;
  uploadStorage?: UploadStorageAdapter;
}): express.Express {
  const policyAdapter = options?.policyAdapter ?? createDefaultPolicyAdapter();
  const sourceRegistry = options?.sourceRegistry ?? createDefaultSourceRegistry();
  const repository = options?.repository ?? new FormRepository(makePool());
  const uploadStorage = options?.uploadStorage ?? createUploadStorageAdapterFromEnv();

  const app = express();
  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  registerDevAuthRoutes(app);

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/api/auth/context", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      const capabilities = (await policyAdapter.authorize(ctx, "forms.submit")).capabilities;
      res.status(200).json({
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        isAnonymous: ctx.isAnonymous,
        capabilities
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/forms", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.read");
      const includeArchived = req.query.includeArchived === "true";
      const forms = await repository.listForms({ tenantId: ctx.tenantId, actorId: ctx.actorId }, { includeArchived });
      res.status(200).json(forms);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/forms/:formId", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.read");
      const form = await repository.getFormById({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.formId);
      if (!form) {
        res.status(404).json(errorEnvelope("FORM_NOT_FOUND", "Form not found"));
        return;
      }
      res.status(200).json(form);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/definitions/:definitionId", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.read");
      const definition = await repository.getPublishedDefinitionById(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        req.params.definitionId
      );
      if (!definition) {
        res.status(404).json(errorEnvelope("DEFINITION_NOT_FOUND", "Definition not found"));
        return;
      }
      res.status(200).json(definition);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forms", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.design");

      const payload = createFormSchema.parse(req.body);
      const formId = createStableId("form");
      const parsedDefinition = validateDefinition(payload.definition);
      const definition = validateDefinition({
        ...parsedDefinition,
        metadata: {
          ...parsedDefinition.metadata,
          formId
        }
      });
      const created = await repository.createForm(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        {
          id: formId,
          name: payload.name,
          description: payload.description,
          draft: definition
        }
      );
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forms/:formId/duplicate", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.design");

      const form = await repository.getFormById({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.formId);
      if (!form) {
        res.status(404).json(errorEnvelope("FORM_NOT_FOUND", "Form not found"));
        return;
      }

      const draft = await repository.getDraft({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.formId);
      if (!draft) {
        res.status(404).json(errorEnvelope("DRAFT_NOT_FOUND", "Draft not found"));
        return;
      }

      const duplicated = remapDefinitionStableIds(draft.definition);
      duplicated.metadata.name = `${draft.definition.metadata.name} copy`;
      const created = await repository.createForm(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        {
          id: createStableId("form"),
          name: `${form.name} copy`,
          description: form.description ?? undefined,
          draft: duplicated
        }
      );

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/forms/:formId/export", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.export");

      const draft = await repository.getDraft({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.formId);
      if (!draft) {
        res.status(404).json(errorEnvelope("DRAFT_NOT_FOUND", "Draft not found"));
        return;
      }

      res.status(200).json(exportDefinitionEnvelope(draft.definition));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forms/import-as-new", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.design");

      const payload = importAsNewSchema.parse(req.body);
      const imported = importDefinitionEnvelope(payload.envelope);
      const remapped = remapDefinitionStableIds(imported);
      const created = await repository.createForm(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        {
          id: createStableId("form"),
          name: payload.name,
          description: payload.description,
          draft: remapped
        }
      );

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forms/:formId/import-replace/preview", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.design");

      const imported = importDefinitionEnvelope(req.body?.envelope);
      const current = await repository.getDraft({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.formId);
      if (!current) {
        res.status(404).json(errorEnvelope("DRAFT_NOT_FOUND", "Draft not found"));
        return;
      }

      const diff = compareDefinitions(current.definition, imported);
      res.status(200).json({
        currentRevision: current.revision,
        addedFieldIds: diff.added,
        removedFieldIds: diff.removed,
        renamed: diff.renamed
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forms/:formId/import-replace/commit", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.design");

      const payload = importReplaceSchema.parse(req.body);
      const imported = importDefinitionEnvelope(payload.envelope);
      const remapped = remapDefinitionStableIds(imported);

      const saved = await repository.saveDraft(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        req.params.formId,
        payload.expectedRevision,
        remapped
      );

      res.status(200).json(saved);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forms/:formId/archive", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.archive");
      await repository.archiveForm({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.formId, true);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forms/:formId/restore", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.archive");
      await repository.archiveForm({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.formId, false);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/forms/:formId/draft", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.design");
      const draft = await repository.getDraft({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.formId);
      if (!draft) {
        res.status(404).json(errorEnvelope("FORM_NOT_FOUND", "Form draft not found"));
        return;
      }
      res.status(200).json(draft);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/forms/:formId/draft", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.design");

      const payload = saveDraftSchema.parse(req.body);
      const validated = validateDefinition(payload.definition);

      const saved = await repository.saveDraft(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        req.params.formId,
        payload.expectedRevision,
        validated
      );
      res.status(200).json(saved);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forms/:formId/publish", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.publish");
      const payload = publishSchema.parse(req.body);
      const published = await repository.publishDraft(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        req.params.formId,
        payload.expectedRevision
      );
      res.status(201).json(published);
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/forms/:formId/uploads",
    express.raw({ type: "application/octet-stream", limit: process.env.FORM_UPLOAD_MAX_BYTES ?? "20mb" }),
    async (req, res, next) => {
      try {
        const ctx = await policyAdapter.resolveContext(req);
        await requireCapability(policyAdapter, ctx, "forms.upload");

        const fileName = req.header("x-file-name");
        const contentType = req.header("x-file-content-type") ?? "application/octet-stream";
        if (!fileName) {
          res.status(400).json(errorEnvelope("UPLOAD_FILE_NAME_REQUIRED", "x-file-name header is required"));
          return;
        }
        if (!Buffer.isBuffer(req.body)) {
          res.status(400).json(errorEnvelope("UPLOAD_BODY_REQUIRED", "Binary body is required"));
          return;
        }

        const stored = await uploadStorage.storeObject({
          tenantId: ctx.tenantId,
          uploadId: createStableId("upload"),
          fileName,
          contentType,
          stream: Readable.from(req.body)
        });

        const created = await repository.createUpload({
          ctx: { tenantId: ctx.tenantId, actorId: ctx.actorId },
          formId: req.params.formId,
          fileName,
          contentType,
          sizeBytes: stored.sizeBytes,
          objectKey: stored.objectKey
        });

        res.status(201).json({ uploadId: created.uploadId, fileName, sizeBytes: stored.sizeBytes });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get("/api/uploads/:uploadId/download", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.read");

      const upload = await repository.getUploadById({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.uploadId);
      if (!upload) {
        res.status(404).json(errorEnvelope("UPLOAD_NOT_FOUND", "Upload not found"));
        return;
      }

      const object = await uploadStorage.getObject({
        tenantId: ctx.tenantId,
        objectKey: upload.objectKey,
        contentType: upload.contentType,
        sizeBytes: upload.sizeBytes
      });

      res.setHeader("Content-Type", object.contentType);
      res.setHeader("Content-Length", String(object.sizeBytes));
      res.setHeader("Content-Disposition", `attachment; filename=\"${safeFileName(upload.fileName)}\"`);
      object.stream.pipe(res);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/uploads/:uploadId", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.delete");

      const upload = await repository.getUploadById({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.uploadId);
      if (!upload) {
        res.status(404).json(errorEnvelope("UPLOAD_NOT_FOUND", "Upload not found"));
        return;
      }

      await repository.markUploadDeletionPending({ tenantId: ctx.tenantId, actorId: ctx.actorId }, upload.id);
      await uploadStorage.deleteObject({ tenantId: ctx.tenantId, objectKey: upload.objectKey });
      await repository.deleteUploadRow({ tenantId: ctx.tenantId, actorId: ctx.actorId }, upload.id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/records", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.submit");

      const idempotencyKey = req.header("idempotency-key");
      if (!idempotencyKey) {
        res.status(400).json(errorEnvelope("IDEMPOTENCY_REQUIRED", "idempotency-key header is required"));
        return;
      }

      const payload = saveRecordSchema.parse(req.body);
      const replay = await repository.withIdempotency(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        "records.save",
        idempotencyKey,
        payload,
        async () => {
          const definitionResult = await repository.getPublishedDefinitionById(
            { tenantId: ctx.tenantId, actorId: ctx.actorId },
            payload.definitionId
          );

          if (!definitionResult) {
            return {
              statusCode: 400,
              response: errorEnvelope("DEFINITION_NOT_FOUND", "Published definition not found")
            };
          }

          const resolved = await applyDefinitionSources(definitionResult.definition, payload.values, async (sourceId, values) =>
            sourceRegistry.resolveSourceValue(sourceId, ctx, values)
          );
          const fieldErrors = await validateSubmissionAgainstDefinition(definitionResult.definition, resolved);
          if (fieldErrors.length > 0) {
            return {
              statusCode: 422,
              response: errorEnvelope("VALIDATION_FAILED", "Submission failed validation", fieldErrors)
            };
          }

          const created = await repository.createRecordRevision({
            ctx: { tenantId: ctx.tenantId, actorId: ctx.actorId },
            formId: definitionResult.formId,
            definitionId: payload.definitionId,
            recordId: payload.recordId,
            values: resolved,
            selectedLabels: {},
            uploadIds: payload.uploadIds
          });

          return { statusCode: 201, response: created };
        }
      );

      res.status(replay.statusCode).json(replay.response);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/records/:recordId/history", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.history");
      const revisions = await repository.listRecordRevisions({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.recordId);
      res.status(200).json(revisions);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/records/:recordId/migrations/preview", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.edit");

      const payload = recordMigrationSchema.parse(req.body);
      const revisions = await repository.listRecordRevisions({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.recordId);
      if (!revisions.length) {
        res.status(404).json(errorEnvelope("RECORD_NOT_FOUND", "Record not found"));
        return;
      }

      const latest = revisions[0];
      const sourceDefinition = await repository.getPublishedDefinitionById(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        latest.definitionId
      );
      const targetDefinition = await repository.getPublishedDefinitionById(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        payload.targetDefinitionId
      );

      if (!sourceDefinition || !targetDefinition) {
        res.status(404).json(errorEnvelope("DEFINITION_NOT_FOUND", "Definition not found"));
        return;
      }

      const preview = previewRecordMigration(sourceDefinition.definition, targetDefinition.definition, latest.values);
      res.status(200).json(preview);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/records/:recordId/migrations/commit", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.edit");

      const payload = recordMigrationSchema.parse(req.body);
      const revisions = await repository.listRecordRevisions({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.recordId);
      if (!revisions.length) {
        res.status(404).json(errorEnvelope("RECORD_NOT_FOUND", "Record not found"));
        return;
      }

      const latest = revisions[0];
      const sourceDefinition = await repository.getPublishedDefinitionById(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        latest.definitionId
      );
      const targetDefinition = await repository.getPublishedDefinitionById(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        payload.targetDefinitionId
      );

      if (!sourceDefinition || !targetDefinition) {
        res.status(404).json(errorEnvelope("DEFINITION_NOT_FOUND", "Definition not found"));
        return;
      }

      const migrated = migrateRecordValuesToDefinition(targetDefinition.definition, latest.values);
      const fieldErrors = await validateSubmissionAgainstDefinition(targetDefinition.definition, migrated);
      if (fieldErrors.length > 0) {
        res.status(422).json(errorEnvelope("MIGRATION_VALIDATION_FAILED", "Migration requires missing values", fieldErrors));
        return;
      }

      const created = await repository.createRecordRevision({
        ctx: { tenantId: ctx.tenantId, actorId: ctx.actorId },
        formId: sourceDefinition.formId,
        definitionId: targetDefinition.id,
        recordId: req.params.recordId,
        values: migrated,
        selectedLabels: {}
      });

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/records/:recordId", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.delete");

      const erased = await repository.deleteRecordAndRevisions({ tenantId: ctx.tenantId, actorId: ctx.actorId }, req.params.recordId);
      for (const objectKey of erased.objectKeys) {
        await uploadStorage.deleteObject({ tenantId: ctx.tenantId, objectKey });
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      res.status(400).json(errorEnvelope("BAD_REQUEST", error.issues[0]?.message ?? "Invalid request payload"));
      return;
    }

    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") {
        res.status(403).json(errorEnvelope("FORBIDDEN", "Permission denied"));
        return;
      }
      if (error.message === "DRAFT_CONFLICT") {
        res.status(409).json(errorEnvelope("DRAFT_CONFLICT", "The draft changed, reload before saving."));
        return;
      }
      if (error.message === "IDEMPOTENCY_PAYLOAD_MISMATCH") {
        res.status(409).json(
          errorEnvelope(
            "IDEMPOTENCY_PAYLOAD_MISMATCH",
            "The same idempotency key cannot be reused with a different payload."
          )
        );
        return;
      }
      if (error.message === "UPLOAD_ATTACH_CONFLICT") {
        res.status(409).json(errorEnvelope("UPLOAD_ATTACH_CONFLICT", "One or more uploads are unavailable to attach."));
        return;
      }
      if (error.message === "UPLOAD_NOT_FOUND") {
        res.status(404).json(errorEnvelope("UPLOAD_NOT_FOUND", "Upload not found."));
        return;
      }
      if (error.message === "FORM_NOT_FOUND") {
        res.status(404).json(errorEnvelope("FORM_NOT_FOUND", "Form not found."));
        return;
      }
      if (error.message === "RECORD_NOT_FOUND") {
        res.status(404).json(errorEnvelope("RECORD_NOT_FOUND", "Record not found."));
        return;
      }
      if (error.message.startsWith("SOURCE_NOT_REGISTERED:")) {
        res.status(422).json(errorEnvelope("SOURCE_NOT_REGISTERED", "One or more source dependencies are not configured."));
        return;
      }
      if (error.message.includes("references unknown source field")) {
        res.status(422).json(errorEnvelope("INVALID_RULE_REFERENCE", "One or more conditions reference a removed field."));
        return;
      }
    }

    res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Unexpected error"));
  });

  return app;
}

async function requireCapability(policyAdapter: PolicyAdapter, ctx: AuthContext, capability: string): Promise<void> {
  const decision = await policyAdapter.authorize(ctx, capability);
  if (!decision.allowed) {
    throw new Error("FORBIDDEN");
  }
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function errorEnvelope(code: string, message: string, fieldErrors?: ValidationError[]): {
  code: string;
  message: string;
  fieldErrors: ValidationError[];
} {
  return {
    code,
    message,
    fieldErrors: fieldErrors ?? []
  };
}

export type FormServer = ReturnType<typeof createFormServer>;
