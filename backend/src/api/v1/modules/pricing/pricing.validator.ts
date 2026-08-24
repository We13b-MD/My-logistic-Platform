import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const estimatePriceSchema = z.object({
  pickupLatitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  pickupLongitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
  dropoffLatitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  dropoffLongitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
  vehicleType: z.enum(["BIKE", "CAR", "VAN", "TRUCK"]),
});

export const updatePricingRuleSchema = z.object({
  baseFare: z.number().nonnegative("Base fare must be a positive number or zero").optional(),
  perKmRate: z.number().nonnegative("Per-KM rate must be a positive number or zero").optional(),
  bikeMultiplier: z.number().positive("Multiplier must be greater than zero").optional(),
  carMultiplier: z.number().positive("Multiplier must be greater than zero").optional(),
  vanMultiplier: z.number().positive("Multiplier must be greater than zero").optional(),
  truckMultiplier: z.number().positive("Multiplier must be greater than zero").optional(),
});

export const verifySubscriptionSchema = z.object({
  reference: z.string().min(1, "Paystack transaction reference is required"),
  planType: z.enum(["MONTHLY", "ANNUAL"]),
});

export const validateEstimatePrice = (req: Request, res: Response, next: NextFunction): void => {
  const result = estimatePriceSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      status: "error",
      errors: result.error.errors.map((err: z.ZodIssue) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
    return;
  }
  req.body = result.data;
  next();
};

export const validateUpdatePricingRule = (req: Request, res: Response, next: NextFunction): void => {
  const result = updatePricingRuleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      status: "error",
      errors: result.error.errors.map((err: z.ZodIssue) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
    return;
  }
  req.body = result.data;
  next();
};

export const validateVerifySubscription = (req: Request, res: Response, next: NextFunction): void => {
  const result = verifySubscriptionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      status: "error",
      errors: result.error.errors.map((err: z.ZodIssue) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
    return;
  }
  req.body = result.data;
  next();
};
