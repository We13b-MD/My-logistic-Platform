import { Router } from "express";
import { TenantController } from "./tenant.controller";
import { validateOnboardTenant } from "./tenant.validator";

const tenantRouter = Router();
const tenantController = new TenantController();

// Route: POST /api/v1/tenants/onboard
tenantRouter.post("/onboard", validateOnboardTenant, (req, res) => tenantController.onboard(req, res));

export { tenantRouter };
