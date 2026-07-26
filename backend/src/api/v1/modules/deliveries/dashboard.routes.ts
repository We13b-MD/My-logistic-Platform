import { Router } from "express";
import { DashBoardController } from "./dashboard.controller";
import {authenticate,authorize} from '../../middlewares/auth.middleware'

const  dashboardRouter = Router();
const dashboardController = new DashBoardController();


dashboardRouter.get(
    '/metrics',
    authenticate,
    authorize(['TENANT_SUPER_ADMIN','TENANT_SUB_ADMIN']),
    (req,res)=> dashboardController.getMetrics(req,res)
)

export {dashboardRouter}