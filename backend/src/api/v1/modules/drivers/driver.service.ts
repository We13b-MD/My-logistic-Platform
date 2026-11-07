import { prisma } from "../../../../config/prisma";
import { Prisma, DeliveryStatus } from "@prisma/client";

export class DriverService {
  /**
   * Create a new driver profile linked to a user.
   * Ensures the user exists, belongs to the correct tenant, has the DRIVER role, and does not already have a profile.
   * Uses a catch on the DB unique constraint (P2002) instead of a check-then-create pattern
   * to eliminate the TOCTOU race condition on double-tap / duplicate requests.
   */
  async createProfile(
    userId: string,
    tenantId: string,
    data: { vehicleType: string; licenseNumber: string }
  ) {
    // 1. Fetch user to verify role and tenant
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.tenantId !== tenantId) {
      throw new Error("Access denied: User belongs to a different tenant");
    }

    if (user.role !== "DRIVER") {
      throw new Error("Only users with role DRIVER can create a driver profile");
    }

    // 2. Attempt to create the profile — let the DB unique constraint be the race-condition guard.
    // If two requests arrive simultaneously, one will get a P2002 unique violation which we
    // catch and convert to a clean, user-friendly error message.
    try {
      const profile = await prisma.driverProfile.create({
        data: {
          userId,
          vehicleType: data.vehicleType,
          licenseNumber: data.licenseNumber,
        },
      });

      return profile;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new Error("Driver profile already exists for this user");
      }
      throw e; // rethrow anything unexpected
    }
  }

  /**
   * Retrieve a driver's own profile, ensuring tenant isolation.
   */
  async getProfile(userId: string, tenantId: string) {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            tenantId: true,
          },
        },
      },
    });

    if (!profile) {
      throw new Error("Driver profile not found");
    }

    if (profile.user.tenantId !== tenantId) {
      throw new Error("Access denied: Driver belongs to a different tenant");
    }

    return profile;
  }

  /**
   * Update driver's own profile information, ensuring tenant isolation.
   */
  async updateProfile(
    userId: string,
    tenantId: string,
    data: { vehicleType?: string; licenseNumber?: string }
  ) {
    // 1. Retrieve profile and verify tenant
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!profile) {
      throw new Error("Driver profile not found");
    }

    if (profile.user.tenantId !== tenantId) {
      throw new Error("Access denied: Driver belongs to a different tenant");
    }

    // 2. Perform update
    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: {
        vehicleType: data.vehicleType,
        licenseNumber: data.licenseNumber,
      },
    });

    return updatedProfile;
  }

  /**
   * Toggle the online/offline status for a driver, ensuring tenant isolation.
   */
  async toggleOnlineStatus(userId: string, tenantId: string, isOnline: boolean, latitude?: number,
    longitude?: number) {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!profile) {
      throw new Error("Driver profile not found");
    }

    if (profile.user.tenantId !== tenantId) {
      throw new Error("Access denied: Driver belongs to a different tenant");
    }

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: {
        isOnline,
        lastLatitude: latitude,
        lastLongitude: longitude,
      },
    });

    // If coordinates provided, record breadcrumb for any active deliveries currently in progress
    if (latitude !== undefined && longitude !== undefined) {
      try {
        const activeDeliveries = await prisma.delivery.findMany({
          where: {
            driverId: profile.id,
            status: { in: [DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.IN_TRANSIT] }
          },
          select: { id: true }
        });

        for (const d of activeDeliveries) {
          await prisma.locationBreadcrumb.create({
            data: {
              driverId: profile.id,
              deliveryId: d.id,
              latitude,
              longitude,
            }
          }).catch((err) => console.warn(`[Breadcrumb] Failed to record point for delivery ${d.id}:`, err.message));
        }
      } catch (err: any) {
        console.warn("[Breadcrumb] Active deliveries lookup failed:", err.message);
      }
    }

    return updatedProfile;
  }

  /**
   * Get all drivers belonging to the admin's tenant.
   * Restricts list to drivers whose associated User shares the admin's tenantId.
   */
  async listDriversForAdmin(
    tenantId: string,
    filters: { isOnline?: boolean; isVerified?: boolean }
  ) {
    const whereClause: any = {
      user: {
        tenantId: tenantId,
      },
    };

    if (filters.isOnline !== undefined) {
      whereClause.isOnline = filters.isOnline;
    }

    if (filters.isVerified !== undefined) {
      whereClause.isVerified = filters.isVerified;
    }

    const drivers = await prisma.driverProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            tenantId: true,
            createdAt: true,
          },
        },
      },
    });

    return drivers;
  }

  /**
   * Verify a driver's profile, restricted to admins of the same tenant.
   */
  async verifyDriver(driverId: string, tenantId: string, isVerified: boolean) {
    // 1. Fetch profile and verify tenant
    const profile = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!profile) {
      throw new Error("Driver profile not found");
    }

    if (profile.user.tenantId !== tenantId) {
      throw new Error("Access denied: Driver belongs to a different tenant");
    }

    // 2. Update verification status
    const updatedProfile = await prisma.driverProfile.update({
      where: { id: driverId },
      data: { isVerified },
    });

    return updatedProfile;
  }

  /**
   * Record a cash / POS / transfer remittance from a driver to the cashier / dispatcher.
   */
  async recordRemittance(
    tenantId: string,
    driverId: string,
    data: { amount: number; paymentMethod?: string; reference?: string; notes?: string; recordedBy?: string }
  ) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver || driver.user.tenantId !== tenantId) {
      throw new Error("Driver not found or belongs to another tenant");
    }

    if (!data.amount || data.amount <= 0) {
      throw new Error("Remittance amount must be greater than zero");
    }

    const remittance = await prisma.driverRemittance.create({
      data: {
        tenantId,
        driverId,
        amount: Number(data.amount),
        paymentMethod: data.paymentMethod || "CASH",
        reference: data.reference || null,
        notes: data.notes || null,
        recordedBy: data.recordedBy || null,
      },
      include: {
        driver: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });

    return remittance;
  }

  /**
   * Get remittance history for a tenant or specific driver.
   */
  async getRemittances(tenantId: string, driverId?: string) {
    const where: any = { tenantId };
    if (driverId) where.driverId = driverId;

    return await prisma.driverRemittance.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        driver: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
      },
    });
  }

  /**
   * Get complete cash settlement ledger summary across all tenant drivers.
   * Calculates total completed deliveries, total cash collected (fares),
   * total remitted, and current outstanding unremitted balance.
   */
  async getRemittanceSummary(tenantId: string) {
    const drivers = await prisma.driverProfile.findMany({
      where: { user: { tenantId } },
      include: {
        user: { select: { id: true, email: true } },
        deliveries: {
          where: { status: DeliveryStatus.DELIVERED },
          select: { id: true, estimatedPrice: true, distanceKm: true, createdAt: true },
        },
        remittances: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    let fleetTotalCollected = 0;
    let fleetTotalRemitted = 0;

    const driverBreakdowns = drivers.map((driver) => {
      const completedCount = driver.deliveries.length;
      const totalCollected = driver.deliveries.reduce((sum, d) => sum + (d.estimatedPrice || 0), 0);
      const totalRemitted = driver.remittances.reduce((sum, r) => sum + r.amount, 0);
      const pendingBalance = Math.max(0, totalCollected - totalRemitted);

      fleetTotalCollected += totalCollected;
      fleetTotalRemitted += totalRemitted;

      return {
        driverId: driver.id,
        driverEmail: driver.user.email,
        vehicleType: driver.vehicleType,
        licenseNumber: driver.licenseNumber,
        isOnline: driver.isOnline,
        completedDeliveries: completedCount,
        totalCollected,
        totalRemitted,
        pendingBalance,
        recentRemittances: driver.remittances.slice(0, 5),
      };
    });

    const fleetPendingBalance = Math.max(0, fleetTotalCollected - fleetTotalRemitted);

    return {
      fleetTotalCollected,
      fleetTotalRemitted,
      fleetPendingBalance,
      driverBreakdowns,
    };
  }
}
