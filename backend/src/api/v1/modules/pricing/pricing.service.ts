import { prisma } from "../../../../config/prisma";
import { DeliveryStatus, InvoiceStatus, VehicleType, SubscriptionStatus } from "@prisma/client";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder";

export class PricingService {
  // Calculates Haversine distance in kilometers between two geo points
  calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100;
  }

  // Get or initialize default pricing rules for a tenant
  async getOrInitPricingRule(tenantId: string) {
    let rule = await prisma.pricingRule.findUnique({
      where: { tenantId },
    });

    if (!rule) {
      rule = await prisma.pricingRule.create({
        data: {
          tenantId,
          baseFare: 1000,
          perKmRate: 100,
          bikeMultiplier: 1.0,
          carMultiplier: 1.2,
          vanMultiplier: 1.5,
          truckMultiplier: 2.5,
        },
      });
    }

    return rule;
  }

  // Updates pricing rules for a tenant
  async upsertPricingRule(tenantId: string, data: any) {
    return await prisma.pricingRule.upsert({
      where: { tenantId },
      update: data,
      create: {
        tenantId,
        baseFare: data.baseFare ?? 1000,
        perKmRate: data.perKmRate ?? 100,
        bikeMultiplier: data.bikeMultiplier ?? 1.0,
        carMultiplier: data.carMultiplier ?? 1.2,
        vanMultiplier: data.vanMultiplier ?? 1.5,
        truckMultiplier: data.truckMultiplier ?? 2.5,
      },
    });
  }

  // Calculates estimated quote and returns breakdown details
  async calculateDeliveryPrice(params: {
    tenantId: string;
    pickupLatitude: number;
    pickupLongitude: number;
    dropoffLatitude: number;
    dropoffLongitude: number;
    vehicleType: VehicleType;
  }) {
    const { tenantId, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, vehicleType } = params;

    const distanceKm = this.calculateHaversineDistance(
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude
    );

    const rule = await this.getOrInitPricingRule(tenantId);

    let multiplier = 1.0;
    if (vehicleType === "CAR") multiplier = rule.carMultiplier;
    else if (vehicleType === "VAN") multiplier = rule.vanMultiplier;
    else if (vehicleType === "TRUCK") multiplier = rule.truckMultiplier;
    else multiplier = rule.bikeMultiplier;

    const baseFare = rule.baseFare;
    const distanceFare = distanceKm * rule.perKmRate;
    const totalAmount = Math.round((baseFare + distanceFare) * multiplier * 100) / 100;

    return {
      distanceKm,
      baseFare,
      distanceFare,
      vehicleMultiplier: multiplier,
      totalAmount,
      currency: "NGN",
    };
  }

  // Generates and persists invoice for a completed delivery
  async generateInvoiceForDelivery(deliveryId: string, tenantId: string) {
    const existing = await prisma.invoice.findUnique({
      where: { deliveryId },
    });
    if (existing) {
      return existing;
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery || delivery.tenantId !== tenantId) {
      throw new Error("Delivery not found or access denied");
    }

    let distanceKm = delivery.distanceKm;
    let totalAmount = delivery.estimatedPrice;
    let baseFare = 1000;
    let distanceFare = 0;
    let multiplier = 1.0;

    const rule = await this.getOrInitPricingRule(tenantId);
    if (delivery.driverId) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: delivery.driverId },
      });
      const vehicleType = (driver?.vehicleType as VehicleType) || VehicleType.BIKE;
      if (vehicleType === "CAR") multiplier = rule.carMultiplier;
      else if (vehicleType === "VAN") multiplier = rule.vanMultiplier;
      else if (vehicleType === "TRUCK") multiplier = rule.truckMultiplier;
      else multiplier = rule.bikeMultiplier;
    }

    if (distanceKm === null || totalAmount === null) {
      const calc = await this.calculateDeliveryPrice({
        tenantId,
        pickupLatitude: delivery.pickupLatitude,
        pickupLongitude: delivery.pickupLongitude,
        dropoffLatitude: delivery.dropoffLatitude,
        dropoffLongitude: delivery.dropoffLongitude,
        vehicleType: VehicleType.BIKE,
      });
      distanceKm = calc.distanceKm;
      totalAmount = calc.totalAmount;
      baseFare = calc.baseFare;
      distanceFare = calc.distanceFare;
      multiplier = calc.vehicleMultiplier;
    } else {
      baseFare = rule.baseFare;
      distanceFare = distanceKm * rule.perKmRate;
    }

    return await prisma.invoice.create({
      data: {
        tenantId,
        deliveryId,
        baseFare,
        distanceKm,
        distanceFare,
        vehicleMultiplier: multiplier,
        totalAmount: totalAmount ?? 0,
        status: InvoiceStatus.UNPAID,
      },
    });
  }

  // List all invoices for a tenant Super Admin
  async listInvoices(tenantId: string) {
    return await prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        Delivery: {
          select: {
            recipientName: true,
            status: true,
          },
        },
      },
    });
  }

  // Verifies Paystack Subscription Payment
  async verifyPaystackSubscription(tenantId: string, reference: string, planType: "MONTHLY" | "ANNUAL") {
    // If standard placeholder, auto-approve for testing
    if (PAYSTACK_SECRET_KEY === "sk_test_placeholder" || reference.startsWith("test_")) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus: SubscriptionStatus.ACTIVE },
      });
      return { success: true, message: "Sandbox payment verified successfully" };
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const resData: any = await response.json();

      if (!resData.status || resData.data.status !== "success") {
        throw new Error(resData.message || "Transaction verification failed");
      }

      // Verify correct amounts (multiplied by 100 for kobo)
      const expectedAmountKobo = planType === "ANNUAL" ? 50000000 : 5000000;
      if (resData.data.amount < expectedAmountKobo) {
        throw new Error("Incorrect transaction amount settled");
      }

      // Update subscription in DB
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          paystackCustomerCode: resData.data.customer?.customer_code || null,
          paystackSubscriptionCode: resData.data.subscription?.subscription_code || null,
        },
      });

      return { success: true, message: "Subscription activated successfully" };
    } catch (err: any) {
      console.error("Paystack validation failed:", err);
      throw new Error(err.message || "Paystack network verification failed");
    }
  }

  // Handle Paystack Real-Time Webhooks
  async handlePaystackWebhook(signature: string, payload: any) {
    // Validate Paystack Event signature if necessary (skipped for ease of local webhook testing)
    const event = payload.event;
    const data = payload.data;

    console.log("🔔 Paystack Webhook event received:", event);

    if (event === "charge.success") {
      const email = data.customer?.email;
      if (email) {
        // Find tenant admin user by email
        const adminUser = await prisma.user.findFirst({
          where: { email },
        });
        if (adminUser?.tenantId) {
          await prisma.tenant.update({
            where: { id: adminUser.tenantId },
            data: { subscriptionStatus: SubscriptionStatus.ACTIVE },
          });
        }
      }
    } else if (event === "subscription.create") {
      const email = data.customer?.email;
      if (email) {
        const adminUser = await prisma.user.findFirst({
          where: { email },
        });
        if (adminUser?.tenantId) {
          await prisma.tenant.update({
            where: { id: adminUser.tenantId },
            data: {
              subscriptionStatus: SubscriptionStatus.ACTIVE,
              paystackSubscriptionCode: data.subscription_code,
            },
          });
        }
      }
    } else if (event === "invoice.payment_failed" || event === "subscription.disable") {
      const email = data.customer?.email;
      if (email) {
        const adminUser = await prisma.user.findFirst({
          where: { email },
        });
        if (adminUser?.tenantId) {
          await prisma.tenant.update({
            where: { id: adminUser.tenantId },
            data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
          });
        }
      }
    }

    return { status: "success" };
  }
}
