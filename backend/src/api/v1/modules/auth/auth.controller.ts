import { Request, Response } from "express";
import { AuthService } from "./auth.service";

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { user, token } = await authService.register(req.body);
      res.status(201).json({
        status: "success",
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
          },
          token,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Registration failed",
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { user, token } = await authService.login(req.body);
      res.status(200).json({
        status: "success",
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          token,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        status: "error",
        message: error.message || "Login failed",
      });
    }
  }
}
