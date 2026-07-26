import {Request, Response} from 'express'
import { DashBoardService } from './dashboard.service'

const dashBoardService = new DashBoardService();

export class DashBoardController{
    async getMetrics(req: Request, res:Response){
          try{
            //read  tenantId directly from the verified user session token 
            const tenantId = (req as any).user.tenantId;
            const  metrics = await dashBoardService.getMetrics(tenantId);
            return res.status(200).json({
                status:'success',
                data:metrics
            });
          }catch(err:any){
            return res.status(400).json({
                status:'error',
                message:err.message
            })
          }
    }
}
