import { Request, Response, NextFunction } from "express";
import { z } from "zod";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
      passwordRegex,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  role: z.enum(["CUSTOMER", "DRIVER", "ADMIN"]).optional(),
  tenantId: z.string().uuid("Invalid tenant ID format"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const validateRegister = (req: Request, res: Response, next: NextFunction): void => {
  const result = registerSchema.safeParse(req.body);
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

export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  const result = loginSchema.safeParse(req.body);
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

