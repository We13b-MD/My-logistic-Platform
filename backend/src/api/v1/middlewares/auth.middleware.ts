import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
