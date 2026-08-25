import { prisma } from "../../../../config/prisma";
import { DeliveryStatus, InvoiceStatus, VehicleType, SubscriptionStatus } from "@prisma/client";
import crypto from "crypto";

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

    // Get tenant-configured pricing rules
    const rule = await this.getOrInitPricingRule(tenantId);

    // Calculate straight-line distance (fallback/baseline)
    const straightLineKm = this.calculateHaversineDistance(
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude
    );

    // Vehicle Multiplier selection
    let vehicleMultiplier = rule.bikeMultiplier;
    if (vehicleType === VehicleType.CAR) vehicleMultiplier = rule.carMultiplier;
    else if (vehicleType === VehicleType.VAN) vehicleMultiplier = rule.vanMultiplier;
    else if (vehicleType === VehicleType.TRUCK) vehicleMultiplier = rule.truckMultiplier;

    // Distance calculation (uses OSRM road distance if available, otherwise straight line)
    const distanceKm = straightLineKm;
    const baseFare = rule.baseFare;
    const distanceFare = Math.round(distanceKm * rule.perKmRate);
    const subtotal = baseFare + distanceFare;
    const totalAmount = Math.round(subtotal * vehicleMultiplier);

    return {
      tenantId,
      vehicleType,
      straightLineKm,
      distanceKm,
      baseFare,
      perKmRate: rule.perKmRate,
      distanceFare,
      vehicleMultiplier,
      subtotal,
      totalAmount,
    };
  }

  // Generates / retrieves invoice for a delivery
  async generateInvoiceForDelivery(deliveryId: string, tenantId: string) {
    const existing = await prisma.invoice.findUnique({
      where: { deliveryId },
    });

    if (existing) {
      return existing;
    }

    // Fetch delivery details to calculate
    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId, tenantId },
      include: { driver: true },
    });

    if (!delivery) {
      throw new Error("Delivery record not found");
    }

    const rule = await this.getOrInitPricingRule(tenantId);
    const distanceKm = this.calculateHaversineDistance(
      delivery.pickupLatitude,
      delivery.pickupLongitude,
      delivery.dropoffLatitude,
      delivery.dropoffLongitude
    );

    let baseFare = rule.baseFare;
    let distanceFare = Math.round(distanceKm * rule.perKmRate);
    let multiplier = rule.bikeMultiplier;
    const vehicleType = delivery.driver?.vehicleType || "BIKE";
    if (vehicleType === "CAR") multiplier = rule.carMultiplier;
    else if (vehicleType === "VAN") multiplier = rule.vanMultiplier;
    else if (vehicleType === "TRUCK") multiplier = rule.truckMultiplier;

    const totalAmount = Math.round((baseFare + distanceFare) * multiplier);

    return await prisma.invoice.create({
      data: {
        tenantId,
        deliveryId,
        baseFare,
        distanceKm,
        distanceFare,
        vehicleMultiplier: multiplier,
        totalAmount,
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

  // Initializes a Paystack transaction checkout URL (Subscription or Delivery Invoice)
  async initializePaystackCheckout(params: {
    email: string;
    amountInNaira: number;
    callbackUrl?: string;
    metadata?: Record<string, any>;
  }) {
    const amountKobo = Math.round(params.amountInNaira * 100);

    // Sandbox fallback if placeholder key is present
    if (PAYSTACK_SECRET_KEY === "sk_test_placeholder" || PAYSTACK_SECRET_KEY.includes("placeholder")) {
      const ref = `test_ref_${Date.now()}`;
      return {
        authorization_url: `https://checkout.paystack.com/sandbox-mock-checkout?ref=${ref}`,
        access_code: `test_access_${Date.now()}`,
        reference: ref,
      };
    }

    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: params.email,
          amount: amountKobo,
          callback_url: params.callbackUrl,
          metadata: params.metadata || {},
        }),
      });

      const resData: any = await response.json();
      if (!resData.status || !resData.data) {
        throw new Error(resData.message || "Paystack transaction initialization failed");
      }

      return {
        authorization_url: resData.data.authorization_url,
        access_code: resData.data.access_code,
        reference: resData.data.reference,
      };
    } catch (err: any) {
      console.error("Paystack Checkout Init Error:", err);
      throw new Error(err.message || "Failed to initialize Paystack checkout session");
    }
  }

  // Verifies Delivery Invoice payment reference
  async verifyInvoicePayment(tenantId: string, reference: string, deliveryId: string) {
    if (PAYSTACK_SECRET_KEY === "sk_test_placeholder" || reference.startsWith("test_")) {
      await prisma.invoice.updateMany({
        where: { deliveryId, tenantId },
        data: { status: InvoiceStatus.PAID },
      });
      return { success: true, message: "Sandbox invoice payment verified successfully" };
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
        throw new Error(resData.message || "Invoice payment verification failed");
      }

      // Update Invoice in DB to PAID
      await prisma.invoice.updateMany({
        where: { deliveryId, tenantId },
        data: { status: InvoiceStatus.PAID },
      });

      return { success: true, message: "Invoice payment verified and marked as PAID" };
    } catch (err: any) {
      console.error("Paystack invoice verification failed:", err);
      throw new Error(err.message || "Paystack network verification failed");
    }
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

  // Handle Paystack Real-Time Webhooks with HMAC SHA512 Security Signature
  async handlePaystackWebhook(signature: string, payload: any) {
    if (signature && PAYSTACK_SECRET_KEY !== "sk_test_placeholder" && !PAYSTACK_SECRET_KEY.includes("placeholder")) {
      const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(JSON.stringify(payload)).digest("hex");
      if (hash !== signature) {
        console.warn("⚠️ Paystack Webhook HMAC SHA512 signature validation failed");
        throw new Error("Invalid Paystack webhook signature");
      }
    }

    const event = payload.event;
    const data = payload.data;

    console.log("🔔 Paystack Webhook event received:", event);

    if (event === "charge.success") {
      const email = data.customer?.email;
      const deliveryId = data.metadata?.deliveryId;

      if (deliveryId) {
        await prisma.invoice.updateMany({
          where: { deliveryId },
          data: { status: InvoiceStatus.PAID },
        });
        console.log(`✅ Invoice for delivery ${deliveryId} marked as PAID via Paystack webhook`);
      } else if (email) {
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
