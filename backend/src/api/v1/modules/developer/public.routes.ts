import { Router, Request, Response } from "express";
import crypto from "crypto";
import { Prisma, VehicleType } from "@prisma/client";
import { prisma } from "../../../../config/prisma";
import { deliveryQueue } from "../deliveries/delivery.queue";
import { sendOtpEmail } from "../../../../utils/email.util";
import { PricingService } from "../pricing/pricing.service";
import { authenticateApiKey, apiKeyBruteForceLimiter, apiKeyRateLimiter } from "./apiKey.middleware";
import { createShipmentSchema, quoteSchema, listShipmentsQuerySchema, shipmentIdSchema, formatZodErrors } from "./public.validation";
import { toPublicShipment } from "./public.serializer";
import { notifyDeliveryStatusChange } from "./webhook.service";

/**
 * Logistel Public Developer API  —  mounted at /api/public/v1
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-to-server API for merchants (online stores, pharmacies, marketplaces)
 * to create and track deliveries automatically.
 *
 *   GET    /me                      Check your API key works
 *   POST   /quotes                  Price estimate before booking
 *   POST   /shipments               Create a delivery
 *   GET    /shipments               List your deliveries
 *   GET    /shipments/:id           Get one delivery (status + live driver location)
 *   POST   /shipments/:id/cancel    Cancel before pickup
 *
 * ISOLATION: Every query is scoped by apiKeyId. A key can only ever see or
 * modify shipments it created itself — not other merchants', not the courier's.
 */

const publicApiRouter = Router();
const pricingService = new PricingService();

const shipmentInclude = {
  driver: { select: { vehicleType: true, lastLatitude: true, lastLongitude: true } },
} as const;

// Order matters: brute-force guard → authenticate → per-key quota
publicApiRouter.use(apiKeyBruteForceLimiter, authenticateApiKey, apiKeyRateLimiter);

function client(req: Request) {
  return req.apiClient!; // guaranteed by authenticateApiKey
}

function notFound(res: Response) {
  return res.status(404).json({ status: "error", code: "NOT_FOUND", message: "Shipment not found" });
}

function serverError(res: Response, err: unknown, context: string) {
  // Log details internally, never leak stack traces / DB errors to callers
  console.error(`[PublicAPI] ${context}:`, err);
  return res.status(500).json({ status: "error", code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." });
}

// ─── GET /me ─────────────────────────────────────────────────────────────────
publicApiRouter.get("/me", (req, res) => {
  return res.json({ status: "success", data: { keyName: client(req).name, livemode: true } });
});

// ─── POST /quotes ────────────────────────────────────────────────────────────
publicApiRouter.post("/quotes", async (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: "error", code: "VALIDATION_ERROR", errors: formatZodErrors(parsed.error) });
  }
  try {
    const { pickup, dropoff, vehicleType } = parsed.data;
    const quote = await pricingService.calculateDeliveryPrice({
      tenantId: client(req).tenantId,
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      dropoffLatitude: dropoff.latitude,
      dropoffLongitude: dropoff.longitude,
      vehicleType: vehicleType as VehicleType,
    });
    return res.json({
      status: "success",
      data: {
        vehicleType,
        distanceKm: quote.distanceKm,
        baseFare: quote.baseFare,
        distanceFare: quote.distanceFare,
        vehicleMultiplier: quote.vehicleMultiplier,
        totalAmount: quote.totalAmount,
        currency: "NGN",
      },
    });
  } catch (err) {
    return serverError(res, err, "quote");
  }
});

// ─── POST /shipments ─────────────────────────────────────────────────────────
publicApiRouter.post("/shipments", async (req, res) => {
  const parsed = createShipmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: "error", code: "VALIDATION_ERROR", errors: formatZodErrors(parsed.error) });
  }

  const { keyId, tenantId, senderId } = client(req);
  const { reference, vehicleType, pickup, dropoff, recipient } = parsed.data;

  try {
    // Idempotency: retrying with the same reference returns the original shipment
    // instead of creating a duplicate (very common on unstable mobile networks).
    if (reference) {
      const existing = await prisma.delivery.findUnique({
        where: { apiKeyId_externalReference: { apiKeyId: keyId, externalReference: reference } },
        include: shipmentInclude,
      });
      if (existing) {
        return res.status(200).json({ status: "success", duplicate: true, data: toPublicShipment(existing) });
      }
    }

    const quote = await pricingService.calculateDeliveryPrice({
      tenantId,
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      dropoffLatitude: dropoff.latitude,
      dropoffLongitude: dropoff.longitude,
      vehicleType: vehicleType as VehicleType,
    });

    const deliveryOtp = crypto.randomInt(100000, 1000000).toString();

    // Explicit field mapping — request data is never spread into the DB write.
    const delivery = await prisma.delivery.create({
      data: {
        tenantId,
        senderId,
        apiKeyId: keyId,
        externalReference: reference ?? null,
        status: "PENDING",
        pickupAddress: pickup.address,
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        senderPhone: pickup.phone,
        dropoffAddress: dropoff.address,
        dropoffLatitude: dropoff.latitude,
        dropoffLongitude: dropoff.longitude,
        recipientName: recipient.name,
        recipientPhone: recipient.phone,
        recipientEmail: recipient.email ?? null,
        deliveryOtp,
        distanceKm: quote.distanceKm,
        estimatedPrice: quote.totalAmount,
      },
      include: shipmentInclude,
    });

    if (recipient.email) {
      sendOtpEmail(recipient.email, deliveryOtp, "DELIVERY_HANDOFF").catch((err) =>
        console.error("[PublicAPI] Failed to email delivery OTP:", err?.message || err)
      );
    }

    deliveryQueue
      .add("MATCH_DRIVER", {
        deliveryId: delivery.id,
        tenantId,
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
      })
      .catch((err: any) => console.warn("[Queue] Driver matching unavailable:", err?.message || err));

    return res.status(201).json({
      status: "success",
      data: toPublicShipment(delivery),
      // Returned ONCE, only here. The merchant forwards it to their customer
      // (SMS / WhatsApp) — the driver cannot complete the delivery without it.
      recipientOtp: deliveryOtp,
    });
  } catch (err) {
    // Two identical requests raced each other — return the one that won.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && reference) {
      const existing = await prisma.delivery.findUnique({
        where: { apiKeyId_externalReference: { apiKeyId: keyId, externalReference: reference } },
        include: shipmentInclude,
      });
      if (existing) return res.status(200).json({ status: "success", duplicate: true, data: toPublicShipment(existing) });
    }
    return serverError(res, err, "create shipment");
  }
});

// ─── GET /shipments ──────────────────────────────────────────────────────────
publicApiRouter.get("/shipments", async (req, res) => {
  const parsed = listShipmentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ status: "error", code: "VALIDATION_ERROR", errors: formatZodErrors(parsed.error) });
  }
  try {
    const { status, page, limit } = parsed.data;
    const where: Prisma.DeliveryWhereInput = { apiKeyId: client(req).keyId, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      prisma.delivery.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: shipmentInclude }),
      prisma.delivery.count({ where }),
    ]);
    return res.json({
      status: "success",
      data: rows.map(toPublicShipment),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return serverError(res, err, "list shipments");
  }
});

// ─── GET /shipments/:id ──────────────────────────────────────────────────────
publicApiRouter.get("/shipments/:id", async (req, res) => {
  const id = shipmentIdSchema.safeParse(req.params.id);
  if (!id.success) return notFound(res);
  try {
    const delivery = await prisma.delivery.findFirst({
      where: { id: id.data, apiKeyId: client(req).keyId },
      include: shipmentInclude,
    });
    if (!delivery) return notFound(res); // same response whether it doesn't exist or isn't yours
    return res.json({ status: "success", data: toPublicShipment(delivery) });
  } catch (err) {
    return serverError(res, err, "get shipment");
  }
});

// ─── POST /shipments/:id/cancel ──────────────────────────────────────────────
publicApiRouter.post("/shipments/:id/cancel", async (req, res) => {
  const id = shipmentIdSchema.safeParse(req.params.id);
  if (!id.success) return notFound(res);
  const { keyId } = client(req);
  try {
    // Atomic conditional update: only cancellable before the driver picks it up.
    const result = await prisma.delivery.updateMany({
      where: { id: id.data, apiKeyId: keyId, status: { in: ["PENDING", "ASSIGNED"] } },
      data: { status: "CANCELLED" },
    });

    if (result.count === 0) {
      const existing = await prisma.delivery.findFirst({ where: { id: id.data, apiKeyId: keyId }, select: { status: true } });
      if (!existing) return notFound(res);
      return res.status(409).json({
        status: "error",
        code: "CANNOT_CANCEL",
        message: `Shipment is already ${existing.status} and can no longer be cancelled.`,
      });
    }

    notifyDeliveryStatusChange(id.data);
    const delivery = await prisma.delivery.findUnique({ where: { id: id.data }, include: shipmentInclude });
    return res.json({ status: "success", data: toPublicShipment(delivery!) });
  } catch (err) {
    return serverError(res, err, "cancel shipment");
  }
});

// Unknown public routes
publicApiRouter.use((req, res) => {
  res.status(404).json({ status: "error", code: "NOT_FOUND", message: "Endpoint not found" });
});

export { publicApiRouter };
