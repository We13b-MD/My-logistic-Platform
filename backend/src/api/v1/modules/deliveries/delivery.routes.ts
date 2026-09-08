import { Router } from 'express';
import { DeliveryController } from './delivery.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware'
import { validateCreateDelivery, validateUpdateStatus } from './delivery.validation';
import { generalApiLimiter } from '../../middlewares/rateLimiter.middleware';
import { checkTenantSubscription } from '../../middlewares/subscription.middleware';

const deliveryRouter = Router();
const deliveryController = new DeliveryController();


// Create a delivery restricted to active subscriptions/valid trial
deliveryRouter.post(
    '/',
    authenticate,
    checkTenantSubscription,
    authorize(['CUSTOMER', 'TENANT_SUPER_ADMIN', 'TENANT_SUB_ADMIN']),
    generalApiLimiter,
    validateCreateDelivery,
    (req, res) => deliveryController.create(req, res)
);


// Get delivery by id (Accessible by customer, driver, and admin of the same tenant)
deliveryRouter.get(
    '/:id',
    authenticate,
    generalApiLimiter,
    (req, res) => deliveryController.getById(req, res)
);

// List deliveries (Accessible by customer, driver, and admin of the same tenant)
deliveryRouter.get(
    '/',
    authenticate,
    generalApiLimiter,
    (req, res) => deliveryController.list(req, res)
);

// Update delivery status (State machine transitions validated at service level)
deliveryRouter.patch(
    '/:id/status',
    authenticate,
    generalApiLimiter,
    validateUpdateStatus,
    (req, res) => deliveryController.updateStatus(req, res)
);

// Upload POD photo & signature base64 strings to Cloudinary / local fallback
deliveryRouter.post(
    '/upload-pod',
    authenticate,
    generalApiLimiter,
    (req, res) => deliveryController.uploadPOD(req, res)
);

export { deliveryRouter }




/** update  delivery status (State machine transitions validated at service level ) */