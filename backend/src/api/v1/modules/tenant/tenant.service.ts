import bcrypt from "bcrypt";
import { prisma } from "../../../../config/prisma";
import { generateToken } from "../../../../utils/jwt";
import { OnboardTenantDTO } from "./tenant.types";

export class TenantService {
  /**
   * Onboards a new logistics company (tenant) and registers its first Admin user.
   * Runs in a transaction so that if either step fails, everything is rolled back.
   */
  async onboard(data: OnboardTenantDTO) {
    const { companyName, subdomain, industry, adminEmail, adminPassword } = data;

    // 1. Check if subdomain is already taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });
    if (existingTenant) {
      throw new Error("Subdomain is already taken");
    }

    // 2. Check if admin email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (existingUser) {
      throw new Error("Admin email is already in use");
    }

    // 3. Hash the admin's password
    const hashedpassword = await bcrypt.hash(adminPassword, 12);

    // 4. Run inside a database transaction to ensure Atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create the Tenant record
      const tenant = await tx.tenant.create({
        data: {
          companyName,
          subdomain,
          industry,
        },
      });

      // Create the Admin User linked to this Tenant
      const admin = await tx.user.create({
        data: {
          email: adminEmail,
          password: hashedpassword,
          //role: "ADMIN",
          role: "TENANT_SUPER_ADMIN",

          tenantId: tenant.id,
        },
        select: {
          id: true,
          email: true,
          role: true,
          tenantId: true,
          createdAt: true,
        },
      });

      return { tenant, admin };
    });

    // 5. Generate a JWT token for the new Admin
    const token = generateToken(result.admin);

    return {
      tenant: result.tenant,
      admin: result.admin,
      token,
    };
  }

  async getBySubdomain(subdomain: string) {
    return await prisma.tenant.findUnique({
      where: { subdomain: subdomain.toLowerCase() },
      select: {
        id: true,
        companyName: true,
        subdomain: true,
        industry: true,
      },
    });
  }

  /**
   * List all registered tenants with user, driver, and delivery count.
   */
  async listAllTenants() {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users: true,
            deliveries: true,
            vehicles: true,
          },
        },
        users: {
          where: { role: "TENANT_SUPER_ADMIN" },
          select: { email: true },
          take: 1,
        },
      },
    });

    return tenants.map((t) => ({
      id: t.id,
      companyName: t.companyName,
      subdomain: t.subdomain,
      logoUrl: t.logoUrl,
      isActive: t.isActive,
      industry: t.industry,
      createdAt: t.createdAt,
      adminEmail: t.users[0]?.email || "N/A",
      totalUsers: t._count.users,
      totalDeliveries: t._count.deliveries,
      totalVehicles: t._count.vehicles,
    }));
  }

  /**
   * Toggle a tenant's active status (activate/suspend).
   */
  async toggleTenantStatus(id: string, isActive: boolean) {
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new Error("Tenant not found");

    return await prisma.tenant.update({
      where: { id },
      data: { isActive },
      select: { id: true, companyName: true, isActive: true },
    });
  }

  /**
   * Compute platform-wide performance metrics for platform admins.
   */
  async getPlatformMetrics() {
    const [totalTenants, activeTenants, totalUsers, totalDrivers, totalDeliveries, completedDeliveries] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { isActive: true } }),
        prisma.user.count(),
        prisma.driverProfile.count(),
        prisma.delivery.count(),
        prisma.delivery.count({ where: { status: "DELIVERED" } }),
      ]);

    return {
      totalTenants,
      activeTenants,
      suspendedTenants: totalTenants - activeTenants,
      totalUsers,
      totalDrivers,
      totalDeliveries,
      completedDeliveries,
    };
  }
}

