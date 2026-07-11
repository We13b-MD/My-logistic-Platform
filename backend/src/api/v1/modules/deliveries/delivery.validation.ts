import { z } from 'zod';
import { DeliveryStatus } from '@prisma/client'



//purpose for this 

/**rejects invaled payloads before theynhhit our controllers or database
 * This saves CPU  cycles and prevents SQL/data injection 
 * 
 */

export const createDeliverySchema =
    z.object({
        pickupAddress: z.string().min(5, "Pick up address should be at least 5 characters long"),
        pickupLatitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
        pickupLongitude: z.number().min(-180).max(180, "Longitude must be at least -180 and 180"),
        senderPhone: z.string().min(7, "Invalid sender phone neumber"),
        dropoffAddress: z.string().min(5, "Drop off address must be at least 5 characters long"),
        dropoffLatitude: z.number().min(-90).max(90),
        dropoffLongitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
        recipientName: z.string().min(2, "Recipient name must be at least 2 characters long"),
        recipientPhone: z.string().min(7, "Invalid recipient phone number ")

    });

export const updateStatusSchema = z.object({
    status: z.nativeEnum(DeliveryStatus),
    deliveryOtp: z.string().length(6, "OTP must be exactly 6 characters").optional(),
    actualDropoffLatitude:z.number().min(-90).max(90).optional(),
    actualDropoffLongitude:z.number().min(-180).max(180).optional(),

})


//middleware helper to validate request bodies

export const validateCreateDelivery = (req: any, res: any, next: any) => {
    const result = createDeliverySchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ status: "error", errors: result.error.errors })
    }
    next()
}

export const validateUpdateStatus = (req: any, res: any, next: any) => {
    const result = updateStatusSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            status: "error", errors: result.error.errors
        })
    }
    next();
}




