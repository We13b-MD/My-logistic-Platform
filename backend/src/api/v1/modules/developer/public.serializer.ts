import { Delivery, DriverProfile } from "@prisma/client";

/**
 * Converts an internal Delivery row into the shape exposed by the public API.
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY: This is an explicit allow-list. Internal fields such as
 * deliveryOtp, senderId, tenantId, driver emails, GPS breadcrumbs and POD
 * photo URLs are NEVER exposed to third-party integrations.
 */

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || "https://logistel-frontend.onrender.com").replace(/\/$/, "");

const ACTIVE_STATUSES = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"];

type DeliveryWithDriver = Delivery & { driver?: Pick<DriverProfile, "vehicleType" | "lastLatitude" | "lastLongitude"> | null };

export function toPublicShipment(delivery: DeliveryWithDriver) {
  const showDriverLocation =
    ACTIVE_STATUSES.includes(delivery.status) &&
    delivery.driver?.lastLatitude != null &&
    delivery.driver?.lastLongitude != null;

  return {
    id: delivery.id,
    reference: delivery.externalReference,
    status: delivery.status,
    trackingUrl: `${PUBLIC_APP_URL}/track/${delivery.id}`,
    pickup: {
      address: delivery.pickupAddress,
      latitude: delivery.pickupLatitude,
      longitude: delivery.pickupLongitude,
      phone: delivery.senderPhone,
    },
    dropoff: {
      address: delivery.dropoffAddress,
      latitude: delivery.dropoffLatitude,
      longitude: delivery.dropoffLongitude,
    },
    recipient: {
      name: delivery.recipientName,
      phone: delivery.recipientPhone,
      email: delivery.recipientEmail,
    },
    driver: delivery.driver
      ? {
          vehicleType: delivery.driver.vehicleType,
          location: showDriverLocation
            ? { latitude: delivery.driver.lastLatitude, longitude: delivery.driver.lastLongitude }
            : null,
        }
      : null,
    distanceKm: delivery.distanceKm,
    estimatedPrice: delivery.estimatedPrice,
    currency: "NGN",
    proofOfDelivery: delivery.status === "DELIVERED" ? { captured: !!delivery.proofOfDeliveryPhotoUrl } : null,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}
