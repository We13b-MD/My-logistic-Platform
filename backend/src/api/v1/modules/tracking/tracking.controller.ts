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
    }catch(error : any){
        res.status(400).json({status:"error", message: error.message})
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
}