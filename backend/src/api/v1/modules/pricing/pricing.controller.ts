import { Request, Response } from "express";
import { PricingService } from "./pricing.service";
import { prisma } from "../../../../config/prisma";

const pricingService = new PricingService();

export class PricingController {
  // Public/authenticated estimation endpoint
  async estimatePrice(req: Request, res: Response) {
    try {
      let tenantId = req.user?.tenantId;

      if (!tenantId) {
        const firstTenant = await prisma.tenant.findFirst();
        tenantId = firstTenant?.id;
      }

      if (!tenantId) {
        return res.status(400).json({
          status: "error",
          message: "No tenant found on system to calculate rates",
        });
      }

      const { pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, vehicleType } = req.body;

      const estimate = await pricingService.calculateDeliveryPrice({
        tenantId,
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
        vehicleType,
      });

      return res.status(200).json({
        status: "success",
        data: estimate,
      });
    } catch (err: any) {
      return res.status(400).json({
        status: "error",
        message: err.message || "Failed to calculate price estimation",
      });
    }
  }

  // Tenant Owner gets currently configured pricing rates
  async getPricingRule(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ status: "error", message: "Missing tenant context" });
      }

      const rules = await pricingService.getOrInitPricingRule(tenantId);
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subscriptionStatus: true, companyName: true, subdomain: true, createdAt: true }
      });

      return res.status(200).json({
        status: "success",
        data: {
          rules,
          subscriptionStatus: tenant?.subscriptionStatus || "TRIAL",
          companyName: tenant?.companyName || "",
          subdomain: tenant?.subdomain || "",
          createdAt: tenant?.createdAt || new Date(),
        },
      });
    } catch (err: any) {
      return res.status(400).json({
        status: "error",
        message: err.message,
      });
    }
  }

  // Tenant Owner updates pricing rates
  async updatePricingRule(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ status: "error", message: "Missing tenant context" });
      }

      const updated = await pricingService.upsertPricingRule(tenantId, req.body);
      return res.status(200).json({
        status: "success",
        message: "Pricing rates updated successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        status: "error",
        message: err.message,
      });
    }
  }

  // List all invoices
  async listInvoices(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ status: "error", message: "Missing tenant context" });
      }

      const invoices = await pricingService.listInvoices(tenantId);
      return res.status(200).json({
        status: "success",
        data: invoices,
      });
    } catch (err: any) {
      return res.status(400).json({
        status: "error",
        message: err.message,
      });
    }
  }

  // Generate / Retrieve invoice for a specific delivery
  async getInvoice(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { deliveryId } = req.params;
      if (!tenantId) {
        return res.status(401).json({ status: "error", message: "Missing tenant context" });
      }

      const invoice = await pricingService.generateInvoiceForDelivery(deliveryId as string, tenantId);
      return res.status(200).json({
        status: "success",
        data: invoice,
      });
    } catch (err: any) {
      return res.status(400).json({
        status: "error",
        message: err.message,
      });
    }
  }

  // Verify Paystack checkout transaction reference
  async verifySubscription(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ status: "error", message: "Missing tenant context" });
      }

      const { reference, planType } = req.body;
      const result = await pricingService.verifyPaystackSubscription(tenantId, reference, planType);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({
        status: "error",
        message: err.message || "Subscription verification failed",
      });
    }
  }

  // Initialize Paystack Checkout link
  async initializeCheckout(req: Request, res: Response) {
    try {
      const email = req.user?.email || req.body.email;
      const { amountInNaira, callbackUrl, metadata } = req.body;
      if (!email || !amountInNaira) {
        return res.status(400).json({ status: "error", message: "Email and amountInNaira are required" });
      }

      const result = await pricingService.initializePaystackCheckout({
        email,
        amountInNaira,
        callbackUrl,
        metadata: {
          ...metadata,
          tenantId: req.user?.tenantId,
        },
      });

      return res.status(200).json({ status: "success", data: result });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  }

  // Verify delivery invoice payment
  async verifyInvoice(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { reference, deliveryId } = req.body;
      if (!tenantId || !reference || !deliveryId) {
        return res.status(400).json({ status: "error", message: "Missing required parameters" });
      }

      const result = await pricingService.verifyInvoicePayment(tenantId, reference, deliveryId);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  }

  // Paystack Webhook Handler
  async handleWebhook(req: Request, res: Response) {
    try {
      const signature = (req.headers["x-paystack-signature"] as string) || "";
      const result = await pricingService.handlePaystackWebhook(signature, req.body);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({
        status: "error",
        message: err.message || "Webhook processing failed",
      });
    }
  }
}
