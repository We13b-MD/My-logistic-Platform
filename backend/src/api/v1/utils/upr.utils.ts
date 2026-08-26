import crypto from "crypto";

/**
 * Generates a Unique Payment Reference (UPR) based on the Remita RRR pattern.
 * Format: LOG-{TENANT_CODE}-{YYMM}-{HEX6}
 * Example: LOG-APEX-2608-D78F29
 */
export function generateUPR(tenantCode?: string): string {
  const prefix = "LOG";
  const sanitizedTenant = (tenantCode || "GEN")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);

  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dateStr = `${yy}${mm}`;

  const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars hex

  return `${prefix}-${sanitizedTenant}-${dateStr}-${randomHex}`;
}
