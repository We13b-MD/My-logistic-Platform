import { Router } from "express";
import { TrackingController } from "./tracking.controller";
import {authenticate,authorize} from '../../middlewares/auth.middleware'
import { generalApiLimiter } from "../../middlewares/rateLimiter.middleware";

const trackingRouter = Router()

    const controller = new TrackingController();
    //Get current tracking position of a delivery (Available to customers , Drivers and Admins)

    trackingRouter.get(
        "/delivery/:deliveryId",
        authenticate,
        authorize(["CUSTOMER", "DRIVER","TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
        generalApiLimiter,
        (req,res) =>{
            controller.getDeliveryDriverLocation(req,res)
        }
    )


    //Get all active driver locations (Restricted to tenant admins, sub admins)



    trackingRouter.get(
     "/drivers",
     authenticate,
     authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
     generalApiLimiter,
     (req,res) =>{
        controller.getActiveDriverLocations(req,res)
     }
    );

    // Unauthenticated public tracking endpoint (by OTP or Delivery ID)
    trackingRouter.get(
        "/public/:code",
        generalApiLimiter,
        (req, res) => {
            controller.getPublicTrackingInfo(req, res);
        }
    );

    // GPS Breadcrumb Trail — Admin investigation endpoint (Gap 1: cargo diversion audit)
    // Returns the full ordered GPS history for a delivery so admins can replay
    // the exact route the truck took and identify any unauthorized stops or diversions.
    trackingRouter.get(
        "/trail/:deliveryId",
        authenticate,
        authorize(["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]),
        generalApiLimiter,
        (req, res) => {
            controller.getBreadcrumbTrail(req, res);
        }
    );

    export {trackingRouter}










