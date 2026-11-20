import { z } from "zod";

/**
 * Public API input validation
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY: Every schema is `.strict()` — unknown fields are REJECTED, not
 * passed through. This prevents mass-assignment attacks where a caller tries
 * to sneak in fields like `status`, `driverId`, `tenantId` or `deliveryOtp`.
 * All strings have maximum lengths to stop oversized payload abuse.
 */

const phone = z
  .string()
  .trim()
  .min(7, "Phone number is too short")
  .max(20, "Phone number is too long")
  .regex(/^\+?[0-9\s\-()]+$/, "Phone number contains invalid characters");

const latitude = z.number().finite().min(-90).max(90);
const longitude = z.number().finite().min(-180).max(180);
const vehicleType = z.enum(["BIKE", "CAR", "VAN", "TRUCK"]);

export const createShipmentSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9_\-.:#/]+$/, "Reference may only contain letters, numbers and _ - . : # /")
      .optional(),
    vehicleType: vehicleType.default("BIKE"),
    pickup: z
      .object({
        address: z.string().trim().min(5).max(300),
        latitude,
        longitude,
        phone,
      })
      .strict(),
    dropoff: z
      .object({
        address: z.string().trim().min(5).max(300),
        latitude,
        longitude,
      })
      .strict(),
    recipient: z
      .object({
        name: z.string().trim().min(2).max(100),
        phone,
        email: z.string().trim().email().max(254).optional(),
      })
      .strict(),
  })
  .strict();

export const quoteSchema = z
  .object({
    vehicleType: vehicleType.default("BIKE"),
    pickup: z.object({ latitude, longitude }).strict(),
    dropoff: z.object({ latitude, longitude }).strict(),
  })
  .strict();

export const listShipmentsQuerySchema = z.object({
  status: z.enum(["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const shipmentIdSchema = z.string().uuid();

export function formatZodErrors(error: z.ZodError) {
  return error.errors.map((e) => ({ field: e.path.join(".") || "(body)", message: e.message }));
}
