import { Router } from "express";
import { PricingController } from "./pricing.controller";
import { validateEstimatePrice, validateUpdatePricingRule, validateVerifySubscription } from "./pricing.validator";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import { generalApiLimiter } from "../../middlewares/rateLimiter.middleware";

const pricingRouter = Router();
const pricingController = new PricingController();

// 1. Estimate Delivery Fare (Public/Optional Auth - General Rate Limited)
pricingRouter.post(
  "/estimate",
  generalApiLimiter,
  validateEstimatePrice,
  (req, res) => pricingController.estimatePrice(req, res)
);

// 2. Fetch configured pricing rules (Tenant Administrators only)
pricingRouter.get(
  "/rules",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
  (req, res) => pricingController.getPricingRule(req, res)
);

// 3. Update configured pricing rules (Tenant Super Admin only)
pricingRouter.put(
  "/rules",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN"]),
  validateUpdatePricingRule,
  (req, res) => pricingController.updatePricingRule(req, res)
);

// 4. List all invoices (Tenant Administrators only)
pricingRouter.get(
  "/invoices",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
  (req, res) => pricingController.listInvoices(req, res)
);

// 5. Get / generate invoice for a completed delivery
pricingRouter.get(
  "/invoices/:deliveryId",
  authenticate,
  authorize(["CUSTOMER", "TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
  (req, res) => pricingController.getInvoice(req, res)
);

// 6. Initialize Paystack Checkout link (Authenticated users)
pricingRouter.post(
  "/paystack/initialize",
  authenticate,
  (req, res) => pricingController.initializeCheckout(req, res)
);

// 7. Verify Delivery Invoice Payment
pricingRouter.post(
  "/paystack/verify-invoice",
  authenticate,
  (req, res) => pricingController.verifyInvoice(req, res)
);

// 8. Verify Subscription Payment reference (Tenant Super Admin only)
pricingRouter.post(
  "/subscribe/verify",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN"]),
  validateVerifySubscription,
  (req, res) => pricingController.verifySubscription(req, res)
);

// 9. Paystack Real-Time Webhook (Public API Endpoint)
pricingRouter.post(
  "/webhook",
  (req, res) => pricingController.handleWebhook(req, res)
);

export { pricingRouter };
