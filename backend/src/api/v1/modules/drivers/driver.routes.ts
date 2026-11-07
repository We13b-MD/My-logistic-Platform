import { Router } from "express";
import { DriverController } from "./driver.controller";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  validateCreateProfile,
  validateUpdateProfile,
  validateToggleOnline,
  validateVerifyDriver,
} from "./driver.validator";

const driverRouter = Router();
const driverController = new DriverController();

// 1. Create a profile (DRIVER only)
driverRouter.post(
  "/profile",
  authenticate,
  authorize(["DRIVER"]),
  validateCreateProfile,
  (req, res) => driverController.createProfile(req, res)
);

// 2. Get my profile (DRIVER only)
driverRouter.get(
  "/me",
  authenticate,
  authorize(["DRIVER"]),
  (req, res) => driverController.getProfile(req, res)
);

// 3. Update my profile (DRIVER only)
driverRouter.put(
  "/profile",
  authenticate,
  authorize(["DRIVER"]),
  validateUpdateProfile,
  (req, res) => driverController.updateProfile(req, res)
);

// 4. Toggle online status (DRIVER only)
driverRouter.patch(
  "/online",
  authenticate,
  authorize(["DRIVER"]),
  validateToggleOnline,
  (req, res) => driverController.toggleOnline(req, res)
);

// 5. List drivers (super admin and sub admin )
driverRouter.get(
  "/",
  authenticate,
  //authorize(["ADMIN"]),
    authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
  (req, res) => driverController.listDrivers(req, res)
);

// 6. Verify a driver (ADMIN only)
driverRouter.patch(
  "/:id/verify",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN"]),
  validateVerifyDriver,
  (req, res) => driverController.verifyDriver(req, res)
);

// 7. Get fleet remittance summary (admin-only)
driverRouter.get(
  "/remittance-summary",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
  (req, res) => driverController.getRemittanceSummary(req, res)
);

// 8. Get remittance history (admin-only)
driverRouter.get(
  "/remittances",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
  (req, res) => driverController.getRemittances(req, res)
);

// 9. Record a driver cash remittance (admin-only)
driverRouter.post(
  "/:id/remittance",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
  (req, res) => driverController.recordRemittance(req, res)
);

export { driverRouter };

