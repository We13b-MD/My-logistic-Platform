import { prisma } from "../../../../config/prisma";

export class DriverService {
  /**
   * Create a new driver profile linked to a user.
   * Ensures the user exists, belongs to the correct tenant, has the DRIVER role, and does not already have a profile.
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

    // 2. Check if profile already exists
    const existingProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new Error("Driver profile already exists for this user");
    }

    // 3. Create the profile
    const profile = await prisma.driverProfile.create({
      data: {
        userId,
        vehicleType: data.vehicleType,
        licenseNumber: data.licenseNumber,
      },
    });

    return profile;
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
  async toggleOnlineStatus(userId: string, tenantId: string, isOnline: boolean,  latitude?: number, 
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
      data: { isOnline , lastLatitude: latitude,
        lastLongitude: longitude},
      
    });

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
}
