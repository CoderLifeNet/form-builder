import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { AuthContext } from "../index.js";

export type DemoUser = {
  userId: string;
  tenants: string[];
  capabilities: string[];
};

const demoUsers: DemoUser[] = [
  {
    userId: "owner1",
    tenants: ["tenant_alpha"],
    capabilities: [
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
    ]
  },
  {
    userId: "collab1",
    tenants: ["tenant_alpha"],
    capabilities: ["forms.submit", "forms.read", "forms.edit", "forms.history", "forms.upload"]
  },
  {
    userId: "outsider1",
    tenants: ["tenant_beta"],
    capabilities: ["forms.submit"]
  }
];

const sessionStore = new Map<string, DemoUser>();

export function registerDevAuthRoutes(app: {
  post: (path: string, handler: (req: Request, res: Response) => void) => void;
}): void {
  app.post("/dev/login", (req: Request, res: Response) => {
    if (process.env.FORM_DEV_AUTH !== "true") {
      res.status(404).json({ code: "NOT_FOUND" });
      return;
    }

    const body = req.body as { userId?: string; tenantId?: string };
    const user = demoUsers.find((candidate) => candidate.userId === body.userId);
    if (!user) {
      res.status(400).json({ code: "UNKNOWN_USER" });
      return;
    }

    const tenantId = body.tenantId ?? user.tenants[0];
    if (!user.tenants.includes(tenantId)) {
      res.status(403).json({ code: "TENANT_NOT_ALLOWED" });
      return;
    }

    const token = randomBytes(16).toString("hex");
    sessionStore.set(token, { ...user, tenants: [tenantId] });

    res.cookie("form_dev_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/"
    });
    res.status(200).json({ ok: true, userId: user.userId, tenantId });
  });
}

export function getDevSessionContext(req: Request): AuthContext | null {
  const token = req.cookies?.form_dev_session as string | undefined;
  if (!token) {
    return null;
  }

  const user = sessionStore.get(token);
  if (!user) {
    return null;
  }

  return {
    actorId: user.userId,
    tenantId: user.tenants[0],
    isAnonymous: false
  };
}

export function getDevUserCapabilities(actorId: string, tenantId: string): string[] {
  const user = demoUsers.find((candidate) => candidate.userId === actorId && candidate.tenants.includes(tenantId));
  return user?.capabilities ?? [];
}
