import {Request, Response} from 'express'
import { TrackingService } from './tracking.service'

export class TrackingController{
    private service: TrackingService
    constructor(service: TrackingService = new TrackingService()){
        this.service= service;
    }

 //Retrives the location of the driver assigned to the delivery

 async getDeliveryDriverLocation(req:Request, res:Response):Promise<void>{
    try{
        const {deliveryId} = req.params;
        const tenantId = req.user?.tenantId;
        if(!tenantId){
            res.status(401).json({
                status:'error', message:"Unauthorized: Missing tenant ID"
            });
            return;
        }
        const trackingData = await this.service.getDeliveryDriverLocation(deliveryId as string , tenantId as string);
        res.status(200).json({
            status: 'success', data: trackingData
        })
    } catch (error: any) {
        if (error.message?.includes('No driver has been assigned')) {
            res.status(200).json({
                status: 'success',
                data: { deliveryId: req.params.deliveryId, driver: null, message: error.message }
            });
            return;
        }
        res.status(400).json({ status: "error", message: error.message });
    }
 }



//Retrieves all active online drivers for the tenant

    async getActiveDriverLocations(req:Request, res:Response):Promise<void>{
        try{
            const tenantId = req.user?.tenantId;
            if(!tenantId){
                res.status(401).json({message: 'Unauthorized missing tenant'});
                return
            }
            const drivers = await this.service.getActiveDriversLocations(tenantId);
            res.status(200).json({
                status:'success', data: drivers
            })
        }catch(error: any){
            res.status(400).json({
                status:'error', message:error.message 
            })
        }
    }

    /**
     * Unauthenticated public tracking request by code or OTP.
     */
    async getPublicTrackingInfo(req: Request, res: Response): Promise<void> {
        try {
            const code = (req.params.code as string) || (req.query.code as string);
            if (!code) {
                res.status(400).json({ status: "error", message: "Tracking code or OTP is required" });
                return;
            }

            const data = await this.service.getPublicTrackingInfo(code);
            res.status(200).json({
                status: "success",
                data,
            });
        } catch (error: any) {
            const statusCode = error.message?.includes("No shipment found") ? 404 : 400;
            res.status(statusCode).json({
                status: "error",
                message: error.message || "Failed to retrieve public tracking info",
            });
        }
    }

    /**
     * getBreadcrumbTrail
     * GET /tracking/trail/:deliveryId
     * Admin-only: Returns the full ordered GPS history for a delivery.
     * Used to investigate cargo diversion, transloading fraud, or route deviation.
     */
    async getBreadcrumbTrail(req: Request, res: Response): Promise<void> {
        try {
            const { deliveryId } = req.params;
            const tenantId = req.user?.tenantId;

            if (!tenantId) {
                res.status(401).json({ status: 'error', message: 'Unauthorized: Missing tenant ID' });
                return;
            }

            const data = await this.service.getBreadcrumbTrail(deliveryId, tenantId);
            res.status(200).json({ status: 'success', data });
        } catch (error: any) {
            const statusCode = error.message?.includes('not found') ? 404 : 400;
            res.status(statusCode).json({ status: 'error', message: error.message });
        }
    }
}
