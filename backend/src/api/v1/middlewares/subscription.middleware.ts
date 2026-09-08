import { Request, Response, NextFunction } from "express";
import { prisma } from "../../../config/prisma";

/**
 * 30-Day Free Pilot & Subscription Guard Middleware
 * Enforces industry-standard access control:
 * - Allows active paid subscriptions (ACTIVE)
 * - Allows tenants within their 30-day free pilot window
 * - Blocks new dispatches and operations with HTTP 402 Payment Required once the 30 days elapse
 */
export async function checkTenantSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;

    // Platform super admins bypass all tenant subscription locks
    if (userRole === "PLATFORM_SUPER_ADMIN" || userRole === "PLATFORM_SUB_ADMIN") {
      next();
      return;
    }

    if (!tenantId) {
      next();
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        companyName: true,
        createdAt: true,
        subscriptionStatus: true,
      },
    });

    if (!tenant) {
      next();
      return;
    }

    // Active paid subscriptions are always allowed
    if (tenant.subscriptionStatus === "ACTIVE") {
      next();
      return;
    }

    // 30-Day Free Trial Duration (30 days in milliseconds)
    const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
    const trialEndsAt = new Date(tenant.createdAt.getTime() + TRIAL_DURATION_MS);
    const now = new Date();

    if (now.getTime() > trialEndsAt.getTime()) {
      res.status(402).json({
        status: "error",
        code: "TRIAL_EXPIRED",
        message: `Your 30-day free pilot for "${tenant.companyName}" has expired. Please activate your subscription under Billing to create new dispatches.`,
        data: {
          trialEndedAt: trialEndsAt.toISOString(),
          daysOverdue: Math.floor((now.getTime() - trialEndsAt.getTime()) / (1000 * 60 * 60 * 24)),
          monthlyRate: 50000,
          currency: "NGN",
        },
      });
      return;
    }

    // 30-day trial is still active
    next();
  } catch (error) {
    console.error("[SubscriptionGuard] Middleware verification error:", error);
    next(); // Fail open on internal unexpected error so we do not break legitimate traffic
  }
}
