import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { tenantRouter } from "./modules/tenant/tenant.routes";
import { driverRouter } from "./modules/drivers/driver.routes";
import { deliveryRouter } from "./modules/deliveries/delivery.routes";
import { dashboardRouter } from "./modules/deliveries/dashboard.routes";
import { trackingRouter } from "./modules/tracking/tracking.routes";
import { vehicleRouter } from "./modules/vehicles/vehicle.routes";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/tenants", tenantRouter);
v1Router.use("/drivers", driverRouter);
v1Router.use("/deliveries", deliveryRouter);
v1Router.use("/dashboard", dashboardRouter);
v1Router.use("/tracking", trackingRouter);
v1Router.use("/vehicles", vehicleRouter);

export default v1Router;


