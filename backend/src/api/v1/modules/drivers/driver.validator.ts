import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const createDriverProfileSchema = z.object({
  vehicleType: z.enum(["BIKE", "VAN", "TRUCK", "CAR"], {
    errorMap: () => ({ message: "Vehicle type must be one of: BIKE, VAN, TRUCK, CAR" }),
  }),
  licenseNumber: z
    .string()
    .min(5, "License number must be at least 5 characters long")
    .trim(),
});

export const updateDriverProfileSchema = z.object({
  vehicleType: z.enum(["BIKE", "VAN", "TRUCK", "CAR"], {
    errorMap: () => ({ message: "Vehicle type must be one of: BIKE, VAN, TRUCK, CAR" }),
  }).optional(),
  licenseNumber: z
    .string()
    .min(5, "License number must be at least 5 characters long")
    .trim()
    .optional(),
});

export const toggleOnlineSchema = z.object({
  isOnline: z.boolean({
    required_error: "isOnline status is required",
    invalid_type_error: "isOnline must be a boolean",
  }),
  latitude: z.number().min(-90).max(90, "Invalid latitude").optional(),
  longitude: z.number().min(-180).max(180, "Invalid longitude").optional(),
});

export const verifyDriverSchema = z.object({
  isVerified: z.boolean({
    required_error: "isVerified status is required",
    invalid_type_error: "isVerified must be a boolean",
  }),
});

export const validateCreateProfile = (req: Request, res: Response, next: NextFunction): void => {
  const result = createDriverProfileSchema.safeParse(req.body);
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

export const validateUpdateProfile = (req: Request, res: Response, next: NextFunction): void => {
  const result = updateDriverProfileSchema.safeParse(req.body);
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

export const validateToggleOnline = (req: Request, res: Response, next: NextFunction): void => {
  const result = toggleOnlineSchema.safeParse(req.body);
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

export const validateVerifyDriver = (req: Request, res: Response, next: NextFunction): void => {
  const result = verifyDriverSchema.safeParse(req.body);
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
