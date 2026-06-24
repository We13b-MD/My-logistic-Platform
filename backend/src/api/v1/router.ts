import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { tenantRouter } from "./modules/tenant/tenant.routes";
import { driverRouter } from "./modules/drivers/driver.routes";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/tenants", tenantRouter);
v1Router.use("/drivers", driverRouter);

export default v1Router;
