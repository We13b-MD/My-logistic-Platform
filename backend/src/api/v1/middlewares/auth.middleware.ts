import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {prisma} from '../../../config/prisma'


// Extend Express Request interface to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        tenantId: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

/**
 * Authentication Middleware:
 * Verifies the JWT token in the Authorization header and attaches the user payload to req.user.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  // 1. Check if the header exists and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      status: "error",
      message: "Authentication token is missing or malformed",
    });
    return;
  }

  // 2. Extract the token
  const token = authHeader.split(" ")[1];

  try {
    // 3. Verify the token using the secret key
    // Note: The generateToken utility stores user.id as userId in the JWT payload
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; tenantId: string };

    // 4. Attach user data to request object
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };

    next();
  } catch (error) {
    res.status(401).json({
      status: "error",
      message: "Invalid or expired token",
    });
  }
};

/**
 * Role-Based Authorization Middleware:
 * Restricts access to specific user roles. Must be placed after the authenticate middleware.
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Check if the user is authenticated (req.user exists)
    if (!req.user) {
      res.status(401).json({
        status: "error",
        message: "User authentication required",
      });
      return;
    }

    // 2. Check if the user's role is permitted
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: "error",
        message: "Forbidden: You do not have permission to perform this action",
      });
      return;
    }

    next();
  };
};


export const authorizeAction = (actionName: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          message: 'User authentication required',
        });
        return;
      }
      
      const userRole = req.user.role;
      const tenantId = req.user.tenantId;

      // Fetch the tenant's permissions block from the database
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { rolePermissions: true }
      });

      if (!tenant) {
        res.status(403).json({
          status: 'error',
          message: 'Access denied tenant not found'
        });
        return;
      }

      // Default policies if no custom policies are set
      const defaultPolicies: Record<string, string[]> = {
        CREATE_DELIVERY: ["CUSTOMER", "TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"],
        VIEW_DASHBOARD: ["TENANT_SUPER_ADMIN"],
        UPDATE_VEHICLE: ["TENANT_SUPER_ADMIN"],
      };

      const tenantPermissions = (tenant.rolePermissions as Record<string, string[]> || defaultPolicies);
      const allowedRoles = tenantPermissions[actionName];

      // Verify if the user's role is allowed
      if (!allowedRoles || !allowedRoles.includes(userRole)) {
        res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have permission to perform this action"
        });
        return;
      }

      next();
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  };
};
