import crypto from "crypto";

/**
 * API Key helpers
 * ─────────────────────────────────────────────────────────────────────────────
 * Key format:  lgs_live_<43 random base64url chars>  (256 bits of entropy)
 *
 * SECURITY NOTES
 * - Keys are generated with a CSPRNG (crypto.randomBytes).
 * - Only the SHA-256 hash is stored. Because the key has 256 bits of entropy,
 *   a fast hash is safe here (brute-forcing it is infeasible) and lets us look
 *   keys up by hash in O(1) without a slow bcrypt compare on every request.
 * - The raw key is returned to the admin exactly once, at creation time.
 */

export const API_KEY_PREFIX = "lgs_live_";

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = API_KEY_PREFIX + crypto.randomBytes(32).toString("base64url");
  return {
    rawKey,
    keyHash: hashApiKey(rawKey),
    keyPrefix: rawKey.slice(0, API_KEY_PREFIX.length + 6), // e.g. lgs_live_a1B2c3
  };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey, "utf8").digest("hex");
}

/** Quick shape check so obviously-invalid keys never hit the database. */
export function looksLikeApiKey(value: string): boolean {
  return /^lgs_live_[A-Za-z0-9_-]{43}$/.test(value);
}

/** Secret used by merchants to verify that webhooks really came from Logistel. */
export function generateWebhookSecret(): string {
  return "whsec_" + crypto.randomBytes(32).toString("base64url");
}
