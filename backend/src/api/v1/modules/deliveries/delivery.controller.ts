import { Request, Response } from 'express';

import { DeliveryService } from './delivery.service';

const deliveryService = new DeliveryService();

export class DeliveryController {
    async create(req: Request, res: Response) {
        try {
            //Extract authenticated userID and tenantID from request context (set by JWT middleware)
            const senderId = (req as any).user.id;
            const tenantId = (req as any).user.tenantId
            const delivery = await deliveryService.create(senderId, tenantId, req.body);
            return res.status(201).json({
                status: 'success',
                data: delivery
            });
        } catch (err: any) {
            return res.status(400).json({
                status: 'error',
                message: err.message
            })
        }

    }

    async getById(req: Request, res: Response) {
        try {
            const tenantId = (req as any).user.tenantId;
            const deliveryId = req.params.id as string;

            const delivery = await deliveryService.getById(deliveryId, tenantId);
            return res.status(200).json({
                status: 'success',
                data: delivery
            })
        } catch (err: any) {
            return res.status(err.message.includes('Access Denied') ? 403 : 404).json({
                status: 'error',
                message: err.message
            })
        }
    }
    async updateStatus(req: Request, res: Response) {
        try {
            const tenantId = (req as any).user.tenantId;
            const deliveryId = req.params.id;
            const {
                status, deliveryOtp, actualDropoffLatitude, actualDropoffLongitude
            } = req.body
            const updatedDelivery = await deliveryService.updateStatus(
                deliveryId,
                tenantId,
                status,
                deliveryOtp,
                actualDropoffLatitude,
                actualDropoffLongitude
            );
            return res.status(200).json({
                status: 'success',
                data: updatedDelivery
            })
        } catch (err: any) {
            return res.status(400).json({
                status: 'error',
                message: err.message
            })
        }
    }
}




