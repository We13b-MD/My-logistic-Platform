import { Router } from "express";
import { VehicleController } from "./vehicle.controller";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  validateCreateVehicle,
  validateUpdateVehicle,
  validateAssignDriver,
} from "./vehicle.validator";

const vehicleRouter = Router();
const vehicleController = new VehicleController();

// 1. Register a new vehicle (TENANT_SUPER_ADMIN strictly)
vehicleRouter.post(
  "/",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN"]),
  validateCreateVehicle,
  (req, res) => vehicleController.createVehicle(req, res)
);

// 2. List fleet vehicles (TENANT_SUPER_ADMIN and TENANT_SUB_ADMIN)
vehicleRouter.get(
  "/",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
  (req, res) => vehicleController.listVehicles(req, res)
);

// 3. Get single vehicle details (TENANT_SUPER_ADMIN and TENANT_SUB_ADMIN)
vehicleRouter.get(
  "/:id",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
  (req, res) => vehicleController.getVehicleById(req, res)
);

// 4. Update vehicle details/maintenance/status (TENANT_SUPER_ADMIN strictly)
vehicleRouter.put(
  "/:id",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN"]),
  validateUpdateVehicle,
  (req, res) => vehicleController.updateVehicle(req, res)
);

// 5. Assign/unassign driver to vehicle (TENANT_SUPER_ADMIN strictly)
vehicleRouter.patch(
  "/:id/assign-driver",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN"]),
  validateAssignDriver,
  (req, res) => vehicleController.assignDriver(req, res)
);

// 6. Delete vehicle asset (TENANT_SUPER_ADMIN strictly)
vehicleRouter.delete(
  "/:id",
  authenticate,
  authorize(["TENANT_SUPER_ADMIN"]),
  (req, res) => vehicleController.deleteVehicle(req, res)
);

export { vehicleRouter };
