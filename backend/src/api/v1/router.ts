import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { tenantRouter } from "./modules/tenant/tenant.routes";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/tenants", tenantRouter);

export default v1Router;
