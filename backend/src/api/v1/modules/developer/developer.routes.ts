import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../../../config/prisma";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import { generalApiLimiter } from "../../middlewares/rateLimiter.middleware";
import { generateApiKey, generateWebhookSecret } from "./apiKey.util";
import { validateWebhookUrl, sendTestWebhook } from "./webhook.service";

/**
 * Developer Settings (dashboard)  —  mounted at /api/v1/developer
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets the company owner create / revoke API keys and configure webhooks.
 * Restricted to TENANT_SUPER_ADMIN. All queries are scoped by tenantId.
 */

const developerRouter = Router();
const MAX_ACTIVE_KEYS = 10;

developerRouter.use(authenticate, authorize(["TENANT_SUPER_ADMIN"]), generalApiLimiter);

const createKeySchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    webhookUrl: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .strict();

const updateKeySchema = z
  .object({
    webhookUrl: z.string().trim().max(500).nullable(),
  })
  .strict();

// Safe projection — keyHash and webhookSecret are NEVER returned after creation
const publicKeyFields = {
  id: true,
  name: true,
  keyPrefix: true,
  webhookUrl: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

async function findOwnKey(req: Request) {
  return prisma.apiKey.findFirst({ where: { id: String(req.params.id), tenantId: req.user!.tenantId } });
}

// ─── List keys ───────────────────────────────────────────────────────────────
developerRouter.get("/keys", async (req: Request, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: "desc" },
      select: { ...publicKeyFields, _count: { select: { deliveries: true } } },
    });
    return res.json({ status: "success", data: keys });
  } catch (err) {
    console.error("[Developer] list keys:", err);
    return res.status(500).json({ status: "error", message: "Failed to load API keys" });
  }
});

// ─── Create key ──────────────────────────────────────────────────────────────
developerRouter.post("/keys", async (req: Request, res: Response) => {
  const parsed = createKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: "error", message: parsed.error.errors[0]?.message || "Invalid input" });
  }
  const { tenantId, id: userId } = req.user!;
  const webhookUrl = parsed.data.webhookUrl || null;

  try {
    if (webhookUrl) {
      const urlError = await validateWebhookUrl(webhookUrl);
      if (urlError) return res.status(400).json({ status: "error", message: urlError });
    }

    const activeCount = await prisma.apiKey.count({ where: { tenantId, revokedAt: null } });
    if (activeCount >= MAX_ACTIVE_KEYS) {
      return res.status(400).json({ status: "error", message: `You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke an unused key first.` });
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const webhookSecret = generateWebhookSecret();

    const key = await prisma.apiKey.create({
      data: { tenantId, createdById: userId, name: parsed.data.name, keyHash, keyPrefix, webhookUrl, webhookSecret },
      select: publicKeyFields,
    });

    return res.status(201).json({
      status: "success",
      message: "Copy these secrets now. For your security they will not be shown again.",
      data: { ...key, apiKey: rawKey, webhookSecret },
    });
  } catch (err) {
    console.error("[Developer] create key:", err);
    return res.status(500).json({ status: "error", message: "Failed to create API key" });
  }
});

// ─── Update webhook URL ──────────────────────────────────────────────────────
developerRouter.patch("/keys/:id", async (req: Request, res: Response) => {
  const parsed = updateKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: "error", message: parsed.error.errors[0]?.message || "Invalid input" });
  }
  try {
    const key = await findOwnKey(req);
    if (!key || key.revokedAt) return res.status(404).json({ status: "error", message: "API key not found" });

    const webhookUrl = parsed.data.webhookUrl || null;
    if (webhookUrl) {
      const urlError = await validateWebhookUrl(webhookUrl);
      if (urlError) return res.status(400).json({ status: "error", message: urlError });
    }

    const updated = await prisma.apiKey.update({ where: { id: key.id }, data: { webhookUrl }, select: publicKeyFields });
    return res.json({ status: "success", data: updated });
  } catch (err) {
    console.error("[Developer] update key:", err);
    return res.status(500).json({ status: "error", message: "Failed to update API key" });
  }
});

// ─── Revoke key (immediate, irreversible) ────────────────────────────────────
developerRouter.delete("/keys/:id", async (req: Request, res: Response) => {
  try {
    const key = await findOwnKey(req);
    if (!key) return res.status(404).json({ status: "error", message: "API key not found" });
    if (!key.revokedAt) {
      await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date(), webhookUrl: null } });
    }
    return res.json({ status: "success", message: "API key revoked. Any system using it will stop working immediately." });
  } catch (err) {
    console.error("[Developer] revoke key:", err);
    return res.status(500).json({ status: "error", message: "Failed to revoke API key" });
  }
});

// ─── Send a test webhook ─────────────────────────────────────────────────────
developerRouter.post("/keys/:id/test-webhook", async (req: Request, res: Response) => {
  try {
    const key = await findOwnKey(req);
    if (!key || key.revokedAt) return res.status(404).json({ status: "error", message: "API key not found" });
    if (!key.webhookUrl || !key.webhookSecret) {
      return res.status(400).json({ status: "error", message: "Add a webhook URL to this key first." });
    }
    const result = await sendTestWebhook(key.webhookUrl, key.webhookSecret);
    return res.json({
      status: result.ok ? "success" : "error",
      message: result.ok
        ? `Webhook delivered (HTTP ${result.status}).`
        : `Webhook failed: ${result.error ?? `endpoint returned HTTP ${result.status}`}`,
    });
  } catch (err) {
    console.error("[Developer] test webhook:", err);
    return res.status(500).json({ status: "error", message: "Failed to send test webhook" });
  }
});

export { developerRouter };
