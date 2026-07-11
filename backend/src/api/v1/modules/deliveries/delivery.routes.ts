import { Router } from 'express';
import { DeliveryController } from './delivery.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware'
import { validateCreateDelivery, validateUpdateStatus } from './delivery.validation';

const deliveryRouter = Router();
const deliveryController = new DeliveryController();


//create a delivery restricted to customer and admind roles
deliveryRouter.post(
    '/',
    authenticate,
    authorize(['CUSTOMER', 'TENANT_SUPER_ADMIN', 'TENANT_SUB_ADMIN']),
    validateCreateDelivery,
    (req, res) => deliveryController.create(req, res)
);

// Get delivery by id (Accessible by customer, driver, and admin of the same tenant 


deliveryRouter.get(
    '/:id',
    authenticate,
    (req, res) => deliveryController.getById(req, res)


);

//update delivery status  (state machine transition validate at service level)

deliveryRouter.patch(
    '/:id/status',
    authenticate,
    validateUpdateStatus,
    (req, res) => deliveryController.updateStatus(req, res)
)

export { deliveryRouter }


/** update  delivery status (State machine transitions validated at service level ) */