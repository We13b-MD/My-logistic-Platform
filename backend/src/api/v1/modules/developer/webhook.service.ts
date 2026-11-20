import crypto from "crypto";
import dns from "dns";
import net from "net";
import { prisma } from "../../../../config/prisma";
import { toPublicShipment } from "./public.serializer";

/**
 * Outgoing Webhooks
 * ─────────────────────────────────────────────────────────────────────────────
 * Notifies a merchant's server whenever a shipment created with their API key
 * changes status.
 *
 * SECURITY
 * 1. SSRF protection — webhook URLs must be HTTPS and must NOT resolve to
 *    private / loopback / link-local / cloud-metadata IP ranges. Checked both
 *    when the URL is saved AND right before every send (defends against DNS
 *    rebinding where a hostname later starts pointing at an internal IP).
 * 2. Redirects are not followed (a public URL cannot bounce us to an internal one).
 * 3. Every payload is HMAC-SHA256 signed with a per-key secret plus a timestamp,
 *    so merchants can verify authenticity and reject replayed requests.
 * 4. Short timeout + bounded retries, fully async — a slow merchant server can
 *    never slow down drivers or dispatchers.
 */

// Allows http:// and private IPs for local testing only. NEVER enable in production.
const ALLOW_INSECURE = process.env.ALLOW_INSECURE_WEBHOOKS === "true" && process.env.NODE_ENV !== "production";

const RETRY_DELAYS_MS = [0, 30_000, 120_000]; // 3 attempts: now, +30s, +2min
const REQUEST_TIMEOUT_MS = 5_000;

// ─── SSRF guard ──────────────────────────────────────────────────────────────

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) ||           // link-local + cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224                               // multicast + reserved
  );
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  const lower = ip.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPrivateIP(lower.slice(7)); // IPv4-mapped IPv6
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") || lower.startsWith("fd") ||   // unique local
    lower.startsWith("fe8") || lower.startsWith("fe9") ||
    lower.startsWith("fea") || lower.startsWith("feb") || // link-local
    lower.startsWith("ff")                                // multicast
  );
}

/**
 * Validates a webhook URL. Returns an error message, or null if the URL is safe.
 */
export async function validateWebhookUrl(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "Webhook URL is not a valid URL";
  }

  if (url.protocol !== "https:" && !(ALLOW_INSECURE && url.protocol === "http:")) {
    return "Webhook URL must use https://";
  }
  if (url.username || url.password) {
    return "Webhook URL must not contain credentials";
  }
  if (rawUrl.length > 500) {
    return "Webhook URL is too long";
  }
  if (ALLOW_INSECURE) return null;

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    return "Webhook URL must point to a public server";
  }

  try {
    const addresses = net.isIP(hostname)
      ? [{ address: hostname }]
      : await dns.promises.lookup(hostname, { all: true });
    if (addresses.length === 0) return "Webhook hostname could not be resolved";
    if (addresses.some((a) => isPrivateIP(a.address))) {
      return "Webhook URL must point to a public server";
    }
  } catch {
    return "Webhook hostname could not be resolved";
  }

  return null;
}

// ─── Signing ─────────────────────────────────────────────────────────────────

/**
 * Header format:  X-Logistel-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>
 * Signed content: `${t}.${rawBody}`
 */
export function signPayload(secret: string, body: string, timestamp: number): string {
  const v1 = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

// ─── Sending ─────────────────────────────────────────────────────────────────

async function postOnce(url: string, secret: string, eventType: string, body: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  // Re-check right before sending (DNS rebinding defence)
  const urlError = await validateWebhookUrl(url);
  if (urlError) return { ok: false, error: urlError };

  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Logistel-Webhooks/1.0",
        "X-Logistel-Event": eventType,
        "X-Logistel-Signature": signPayload(secret, body, timestamp),
      },
      body,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (err: any) {
    return { ok: false, error: err?.name === "TimeoutError" ? "Request timed out" : "Connection failed" };
  }
}

function sendWithRetries(url: string, secret: string, eventType: string, body: string, attempt = 0): void {
  setTimeout(async () => {
    const result = await postOnce(url, secret, eventType, body);
    if (result.ok) return;
    const next = attempt + 1;
    if (next < RETRY_DELAYS_MS.length) {
      sendWithRetries(url, secret, eventType, body, next);
    } else {
      console.warn(`[Webhook] Giving up on ${eventType} after ${RETRY_DELAYS_MS.length} attempts (${result.status ?? result.error})`);
    }
  }, RETRY_DELAYS_MS[attempt]);
}

function buildEvent(type: string, data: unknown) {
  return JSON.stringify({
    id: "evt_" + crypto.randomBytes(12).toString("hex"),
    type,
    createdAt: new Date().toISOString(),
    data,
  });
}

/**
 * Fire-and-forget hook. Call after ANY delivery status change.
 * Does nothing for deliveries that were not created through the public API.
 * Never throws — webhook problems must never break core dispatch operations.
 */
export function notifyDeliveryStatusChange(deliveryId: string | null | undefined): void {
  if (!deliveryId) return;
  (async () => {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        apiKey: { select: { webhookUrl: true, webhookSecret: true, revokedAt: true } },
        driver: { select: { vehicleType: true, lastLatitude: true, lastLongitude: true } },
      },
    });
    const key = delivery?.apiKey;
    if (!delivery || !key || key.revokedAt || !key.webhookUrl || !key.webhookSecret) return;

    const eventType = `shipment.${delivery.status.toLowerCase()}`;
    sendWithRetries(key.webhookUrl, key.webhookSecret, eventType, buildEvent(eventType, toPublicShipment(delivery)));
  })().catch((err) => console.warn("[Webhook] Failed to queue notification:", err?.message || err));
}

/** Sends a single test event immediately and reports the result (used by the dashboard). */
export async function sendTestWebhook(url: string, secret: string) {
  const body = buildEvent("ping", { message: "Logistel webhook test. Your endpoint is connected." });
  return postOnce(url, secret, "ping", body);
}
