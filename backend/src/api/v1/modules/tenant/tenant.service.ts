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
          role: "ADMIN",
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
}
