import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const onboardTenantSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters long"),
  subdomain: z
    .string()
    .min(2, "Subdomain must be at least 2 characters long")
    .regex(/^[a-z0-9-]+$/, "Subdomain must contain only lowercase letters, numbers, and hyphens"),
  adminEmail: z.string().email("Invalid email format"),
  adminPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
});

export const validateOnboardTenant = (req: Request, res: Response, next: NextFunction): void => {
  const result = onboardTenantSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      status: "error",
      errors: result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
    return;
  }
  req.body = result.data;
  next();
};
