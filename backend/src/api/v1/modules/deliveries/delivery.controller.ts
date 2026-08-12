import { Request, Response } from 'express';
import { DeliveryService } from './delivery.service';
import { uploadToCloudStorage } from '../../../../utils/upload.util';

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
            const deliveryId = req.params.id as string;

            const {
                status, deliveryOtp, actualDropoffLatitude, actualDropoffLongitude,
                proofOfDeliveryPhotoUrl, signaturePhotoUrl
            } = req.body;
            const updatedDelivery = await deliveryService.updateStatus(
                deliveryId,
                tenantId,
                status,
                deliveryOtp,
                actualDropoffLatitude,
                actualDropoffLongitude,
                proofOfDeliveryPhotoUrl,
                signaturePhotoUrl
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

    /**
     * Upload base64 POD photo and digital signature canvas drawing to Cloudinary (or local disk fallback).
     */
    async uploadPOD(req: Request, res: Response) {
        try {
            const { photoBase64, signatureBase64 } = req.body;
            let photoUrl: string | undefined;
            let signatureUrl: string | undefined;

            if (photoBase64) {
                photoUrl = await uploadToCloudStorage(photoBase64, 'photos');
            }

            if (signatureBase64) {
                signatureUrl = await uploadToCloudStorage(signatureBase64, 'signatures');
            }

            return res.status(200).json({
                status: 'success',
                data: {
                    proofOfDeliveryPhotoUrl: photoUrl,
                    signaturePhotoUrl: signatureUrl,
                }
            });
        } catch (err: any) {
            return res.status(400).json({
                status: 'error',
                message: err.message || 'Failed to upload POD images'
            });
        }
    }



        async list(req: Request, res: Response) {
        try {
            const tenantId = (req as any).user.tenantId;
            const role = (req as any).user.role;
            const userId = (req as any).user.id;

            const { status, limit, page } = req.query;

            const filters: any = {
                status: status as any,
                limit: limit ? parseInt(limit as string) : undefined,
                page: page ? parseInt(page as string) : undefined,
            };

            // Enforce role-based boundaries:
            if (role === 'DRIVER') {
                filters.driverUserId = userId; // Let the service resolve this to driverId
            } else if (role === 'CUSTOMER') {
                filters.senderId = userId;
            }

            const result = await deliveryService.list(tenantId, filters);

            return res.status(200).json({
                status: 'success',
                data: result.deliveries,
                meta: result.meta
            });
        } catch (err: any) {
            return res.status(400).json({
                status: 'error',
                message: err.message
            });
        }
    }

   
}




