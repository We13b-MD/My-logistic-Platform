import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const createVehicleSchema = z.object({
  plateNumber: z
    .string()
    .min(3, "Plate number must be at least 3 characters long")
    .max(20, "Plate number must not exceed 20 characters")
    .trim(),
  vehicleType: z.enum(["BIKE", "VAN", "TRUCK", "CAR"], {
    errorMap: () => ({ message: "Vehicle type must be one of: BIKE, VAN, TRUCK, CAR" }),
  }),
  status: z.enum(["IDLE", "IN_USE", "MAINTENANCE"], {
    errorMap: () => ({ message: "Status must be one of: IDLE, IN_USE, MAINTENANCE" }),
  }).optional(),
  lastMaintenance: z.string().datetime({ message: "lastMaintenance must be a valid ISO date string" }).optional().nullable(),
  nextMaintenanceDue: z.string().datetime({ message: "nextMaintenanceDue must be a valid ISO date string" }).optional().nullable(),
  driverId: z.string().uuid({ message: "driverId must be a valid UUID" }).optional().nullable(),
});

export const updateVehicleSchema = z.object({
  plateNumber: z.string().min(3).max(20).trim().optional(),
  vehicleType: z.enum(["BIKE", "VAN", "TRUCK", "CAR"]).optional(),
  status: z.enum(["IDLE", "IN_USE", "MAINTENANCE"]).optional(),
  lastMaintenance: z.string().datetime().optional().nullable(),
  nextMaintenanceDue: z.string().datetime().optional().nullable(),
  driverId: z.string().uuid().optional().nullable(),
});

export const assignDriverSchema = z.object({
  driverId: z.string().uuid({ message: "driverId must be a valid UUID" }).nullable(),
});

export const validateCreateVehicle = (req: Request, res: Response, next: NextFunction): void => {
  const result = createVehicleSchema.safeParse(req.body);
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

export const validateUpdateVehicle = (req: Request, res: Response, next: NextFunction): void => {
  const result = updateVehicleSchema.safeParse(req.body);
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

export const validateAssignDriver = (req: Request, res: Response, next: NextFunction): void => {
  const result = assignDriverSchema.safeParse(req.body);
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
