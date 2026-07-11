import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validateRegister, validateLogin } from "./auth.validator";
import { authenticate, authorize } from "../../middlewares/auth.middleware";

const authRouter = Router();
const authController = new AuthController();

authRouter.post("/register", validateRegister, (req, res) => authController.register(req, res));
authRouter.post("/login", validateLogin, (req, res) => authController.login(req, res));

// Protected profile route to test authentication middleware
authRouter.get("/profile", authenticate, (req, res) => {
  res.status(200).json({
    status: "success",
    message: "You have accessed a protected route!",
    user: req.user,
  });
});

// Admin-only test route to verify role authorization middleware
authRouter.get("/admin-only", authenticate, authorize(["TENANT_SUPER_ADMIN"]), (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Welcome Super Admin! You have access to this route.",
  });
});

export { authRouter };
