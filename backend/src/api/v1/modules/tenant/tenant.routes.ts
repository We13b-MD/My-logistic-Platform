import { Router } from "express";
import { TenantController } from "./tenant.controller";
import { validateOnboardTenant } from "./tenant.validator";
import { authenticate, authorize } from "../../middlewares/auth.middleware";

const tenantRouter = Router();
const tenantController = new TenantController();

// Public routes
tenantRouter.post("/onboard", validateOnboardTenant, (req, res) => tenantController.onboard(req, res));
tenantRouter.get("/subdomain/:subdomain", (req, res) => tenantController.getBySubdomain(req, res));

// Platform Admin routes
tenantRouter.get(
  "/",
  authenticate,
  authorize(["PLATFORM_SUPER_ADMIN", "PLATFORM_SUB_ADMIN"]),
  (req, res) => tenantController.listAll(req, res)
);

tenantRouter.get(
  "/platform-metrics",
  authenticate,
  authorize(["PLATFORM_SUPER_ADMIN", "PLATFORM_SUB_ADMIN"]),
  (req, res) => tenantController.getMetrics(req, res)
);

tenantRouter.patch(
  "/:id/status",
  authenticate,
  authorize(["PLATFORM_SUPER_ADMIN", "PLATFORM_SUB_ADMIN"]),
  (req, res) => tenantController.toggleStatus(req, res)
);

export { tenantRouter };

