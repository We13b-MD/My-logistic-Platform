import { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../../../../config/prisma";
import { hashApiKey, looksLikeApiKey } from "./apiKey.util";

declare global {
  namespace Express {
    interface Request {
      apiClient?: {
        keyId: string;
        tenantId: string;
        senderId: string;
        name: string;
      };
    }
  }
}

const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000; // avoid a DB write on every single request
const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function deny(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ status: "error", code, message });
}

/**
 * Authenticates server-to-server requests using the `X-API-Key` header.
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY
 * - We deliberately use a custom header (not Authorization). The global CORS
 *   config only allows `Content-Type` and `Authorization`, so browsers cannot
 *   send X-API-Key cross-origin. This stops merchants from accidentally
 *   embedding their secret key in public website JavaScript.
 * - Revoked keys, deactivated companies and expired trials are rejected.
 * - Generic error messages: we never reveal whether a key exists.
 */
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawKey = req.header("x-api-key")?.trim();

    if (!rawKey || !looksLikeApiKey(rawKey)) {
      deny(res, 401, "INVALID_API_KEY", "Missing or invalid API key. Send it in the X-API-Key header.");
      return;
    }

    const key = await prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(rawKey) },
      include: { tenant: { select: { isActive: true, subscriptionStatus: true, createdAt: true } } },
    });

    if (!key || key.revokedAt) {
      deny(res, 401, "INVALID_API_KEY", "Missing or invalid API key. Send it in the X-API-Key header.");
      return;
    }

    if (!key.tenant.isActive) {
      deny(res, 403, "ACCOUNT_SUSPENDED", "This courier account is currently inactive.");
      return;
    }

    // Same subscription rule as the dashboard: active plan or within 30-day trial
    const trialExpired = Date.now() > key.tenant.createdAt.getTime() + TRIAL_DURATION_MS;
    if (key.tenant.subscriptionStatus !== "ACTIVE" && trialExpired) {
      deny(res, 402, "SUBSCRIPTION_REQUIRED", "The courier's subscription is inactive. Please contact your courier.");
      return;
    }

    req.apiClient = {
      keyId: key.id,
      tenantId: key.tenantId,
      senderId: key.createdById,
      name: key.name,
    };

    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
      prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }

    next();
  } catch (err) {
    console.error("[ApiKey] Authentication error:", err);
    deny(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}

const skipInTests = () => process.env.SKIP_RATE_LIMIT === "true" || process.env.NODE_ENV === "test";

/**
 * Brute-force guard: runs BEFORE authentication. Only failed (4xx) responses
 * count, so a guessing attacker gets blocked while real integrations don't.
 */
export const apiKeyBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: skipInTests,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: { status: "error", code: "TOO_MANY_FAILED_ATTEMPTS", message: "Too many failed requests. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Per-key quota: 60 requests per minute per API key. */
export const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: skipInTests,
  keyGenerator: (req) => req.apiClient?.keyId || ipKeyGenerator(req.ip ?? ""),
  message: { status: "error", code: "RATE_LIMITED", message: "Rate limit exceeded (60 requests/minute). Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
