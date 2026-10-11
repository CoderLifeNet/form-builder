import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import {
  createStableId,
  FormDefinition,
  validateDefinition,
  ValidationError,
  PublishedDefinition
} from "@coderlifenet/form-core";
import { FormRepository, makePool } from "@coderlifenet/form-postgres";
import { z } from "zod";

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
  expectedRevision: z.number().int().positive() });

const saveRecordSchema = z.object({
  formId: z.string().min(1),
  definitionId: z.string().min(1),
  recordId: z.string().optional(),
  values: z.record(z.string(), z.unknown())
});

export function createDefaultPolicyAdapter(): PolicyAdapter {
  return {
    async resolveContext(req): Promise<AuthContext> {
      const tenantId = req.header("x-tenant-id") ?? "tenant_demo";
      const actorId = req.header("x-actor-id") ?? "anonymous";
      const isAnonymous = actorId === "anonymous";
      return { tenantId, actorId, isAnonymous };
    },
    async authorize(ctx, capability): Promise<PolicyDecision> {
      if (ctx.isAnonymous) {
        const anonymousAllowed = new Set(["forms.submit"]);
        return { allowed: anonymousAllowed.has(capability), capabilities: Array.from(anonymousAllowed) };
      }
      return { allowed: true, capabilities: [capability] };
    }
  };
}

export function createDefaultSourceRegistry(): SourceRegistry {
  return {
    async resolveSourceValue(sourceId, ctx): Promise<unknown> {
      if (sourceId === "profile.first_name") {
        return ctx.actorId === "owner1" ? "Owner" : "Collaborator";
      }
      if (sourceId === "profile.last_name") {
        return ctx.actorId === "owner1" ? "One" : "User";
      }
      if (sourceId === "request.categories") {
        return [
          { id: "equipment", label: "Equipment" },
          { id: "access", label: "Access" },
          { id: "other", label: "Other" }
        ];
      }
      throw new Error("SOURCE_NOT_FOUND");
    }
  };
}

export function createFormServer(options?: {
  policyAdapter?: PolicyAdapter;
  sourceRegistry?: SourceRegistry;
  repository?: FormRepository;
}): express.Express {
  const policyAdapter = options?.policyAdapter ?? createDefaultPolicyAdapter();
  const sourceRegistry = options?.sourceRegistry ?? createDefaultSourceRegistry();
  const repository = options?.repository ?? new FormRepository(makePool());

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.post("/api/forms", async (req, res, next) => {
    try {
      const ctx = await policyAdapter.resolveContext(req);
      await requireCapability(policyAdapter, ctx, "forms.design");

      const payload = createFormSchema.parse(req.body);
      const definition = validateDefinition(payload.definition);
      const created = await repository.createForm(
        { tenantId: ctx.tenantId, actorId: ctx.actorId },
        {
          id: createStableId("form"),
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
          const resolved = await enrichValuesFromSources(payload.values, sourceRegistry, ctx);
          const fieldErrors = validateRecordPayload(resolved);
          if (fieldErrors.length > 0) {
            return {
              statusCode: 422,
              response: errorEnvelope("VALIDATION_FAILED", "Submission failed validation", fieldErrors)
            };
          }

          const created = await repository.createRecordRevision({
            ctx: { tenantId: ctx.tenantId, actorId: ctx.actorId },
            formId: payload.formId,
            definitionId: payload.definitionId,
            recordId: payload.recordId,
            values: resolved,
            selectedLabels: {}
          });

          return { statusCode: 201, response: created };
        }
      );

      res.status(replay.statusCode).json(replay.response);
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
        res.status(409).json(errorEnvelope("IDEMPOTENCY_PAYLOAD_MISMATCH", "The same idempotency key cannot be reused with a different payload."));
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

async function enrichValuesFromSources(
  values: Record<string, unknown>,
  sourceRegistry: SourceRegistry,
  ctx: AuthContext
): Promise<Record<string, unknown>> {
  const cloned = { ...values };
  if (cloned.first_name === undefined) {
    cloned.first_name = await sourceRegistry.resolveSourceValue("profile.first_name", ctx, values);
  }
  if (cloned.last_name === undefined) {
    cloned.last_name = await sourceRegistry.resolveSourceValue("profile.last_name", ctx, values);
  }
  return cloned;
}

function validateRecordPayload(values: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!values.title || String(values.title).trim().length < 4) {
    errors.push({
      fieldId: "field_title",
      code: "MIN_LENGTH",
      message: "Request title must contain at least 4 characters"
    });
  }
  return errors;
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
