import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { GoogleAuthService } from "./googleAuth.service";

const authService = new AuthService();
const googleAuthService = new GoogleAuthService();

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

  async googleAuth(req: Request, res: Response): Promise<void> {
    try {
      const { email, googleId, idToken, name, avatarUrl, requestedRole } = req.body;
      if (!email && !idToken) {
        res.status(400).json({ status: "error", message: "Email or ID Token is required for Google OAuth" });
        return;
      }

      const result = await googleAuthService.authenticateWithGoogle({
        email,
        googleId,
        idToken,
        name,
        avatarUrl,
        requestedRole,
      });


      res.status(200).json({
        status: "success",
        data: {
          user: result.user,
          token: result.token,
          isNewUser: result.isNewUser,
        },
      });
    } catch (error: any) {
      console.error("Google Auth Backend Exception:", error);
      res.status(400).json({
        status: "error",
        message: error.message || "Google authentication failed",
      });
    }
  }

  async requestOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      const result = await authService.requestOtp(email);
      res.status(200).json({
        status: "success",
        message: `OTP code sent to ${email}`,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Failed to send OTP email",
      });
    }
  }
}


