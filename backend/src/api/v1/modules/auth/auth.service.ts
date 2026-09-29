import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../../../../config/prisma";
import { generateToken } from "../../../../utils/jwt";
import { RegisterDTO } from "./auth.types";
import { Role } from "@prisma/client";
import { sendOtpEmail } from "../../../../utils/email.util";

interface PasswordResetRecord {
  otpCode: string;
  expiresAt: number;
  userId: string;
}

// In-memory store for password reset OTP codes (10-minute validity)
const passwordResetStore = new Map<string, PasswordResetRecord>();

export class AuthService {
  /**
   * Request password reset OTP.
   * STRICT ENFORCEMENT: Verifies user exists under Logistel (Driver, Dispatcher, Tenant Admin, or Customer)
   * before generating or sending any recovery code.
   */
  async requestOtp(email: string) {
    if (!email || !email.includes("@")) {
      throw new Error("Please provide a valid email address.");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify user exists in the database under any registered role
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new Error(
        `The email "${normalizedEmail}" is not registered under Logistel as a Driver, Dispatcher, Tenant Administrator, or Customer.`
      );
    }

    if (user.deletedAt) {
      throw new Error("This account has been deactivated. Please contact your company administrator.");
    }

    // 2. Generate cryptographically strong 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();

    // 3. Store OTP in memory with 10-minute expiry
    passwordResetStore.set(normalizedEmail, {
      otpCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      userId: user.id,
    });

    // 4. Send branded password reset email
    await sendOtpEmail(user.email, otpCode, "PASSWORD_RESET");

    // 5. Map role to human-friendly display label
    let roleLabel = "Customer";
    if (user.role === "DRIVER") roleLabel = "Fleet Driver";
    else if (user.role === "TENANT_SUB_ADMIN") roleLabel = "Dispatcher / Staff Admin";
    else if (user.role === "TENANT_SUPER_ADMIN") roleLabel = "Tenant Super Administrator";
    else if (user.role === "PLATFORM_SUPER_ADMIN" || user.role === "PLATFORM_SUB_ADMIN") roleLabel = "Logistel Platform Admin";

    return {
      email: user.email,
      role: user.role,
      roleLabel,
      tenantName: user.tenant?.companyName || "Logistel Platform",
    };
  }

  /**
   * Complete password reset using verified OTP code.
   */
  async resetPassword(data: { email: string; otpCode: string; newPassword: string }) {
    const { email, otpCode, newPassword } = data;
    if (!email || !otpCode || !newPassword) {
      throw new Error("Email, verification code, and new password are required.");
    }

    if (newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long.");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = passwordResetStore.get(normalizedEmail);

    if (!record || record.expiresAt < Date.now()) {
      throw new Error("The recovery code has expired or is invalid. Please request a new code.");
    }

    if (record.otpCode !== otpCode.trim()) {
      throw new Error("Invalid verification code. Please check your email and try again.");
    }

    const user = await prisma.user.findUnique({
      where: { id: record.userId },
    });

    if (!user) {
      throw new Error("User account not found.");
    }

    // Hash the new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Clean up consumed OTP
    passwordResetStore.delete(normalizedEmail);

    return {
      success: true,
      message: "Password reset successful! You can now log in with your new password.",
    };
  }

  // Authentication methods will be implemented here
  async register(data: RegisterDTO) {
    const { email, password, role, tenantId } = data;
    
    // 1. Verify the logistics company (tenant) exists
    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenantExists) {
      throw new Error("Logistics company (tenant) not found");
    }

    // 2. Check if the email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('user already exists');
      //prevents duplicate accounts
    }

    const hashedpassword = await bcrypt.hash(password, 12);
    //convert password to secure hash

    // 3. Create user linked to the tenant and select safe fields
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedpassword,
        role: (role ?? "CUSTOMER") as Role,
        tenantId
      },
      include: {
        tenant: true,
      },
    });

    // Generate JWT token for immediate login after register
    const token = generateToken(user);

    return { user, token };
  }

  async login(data: { email: string; password: string }) {
    const { email, password } = data;
    const normalizedEmail = email.toLowerCase().trim();

    let user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
      include: {
        tenant: true,
      },
    });

    // Failsafe: Auto-provision superadmin demo account if missing in local DB
    if (!user && email.toLowerCase() === "superadmin@platform.com") {
      let tenant = await prisma.tenant.findFirst();
      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: {
            companyName: "Platform System Core",
            subdomain: "platform-core",
            industry: "OTHERS",
            isActive: true,
          },
        });
      }
      const hashedpassword = await bcrypt.hash("password123", 12);
      user = await prisma.user.create({
        data: {
          email: "superadmin@platform.com",
          password: hashedpassword,
          role: "PLATFORM_SUPER_ADMIN",
          tenantId: tenant.id,
        },
        include: {
          tenant: true,
        },
      });
    }

    // Failsafe: Auto-provision tenant dispatcher demo account if missing
    if (!user && email.toLowerCase() === "dispatcher@swift.com") {
      let tenant = await prisma.tenant.findFirst();
      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: {
            companyName: "Swift Logistics",
            subdomain: "swift",
            industry: "TRANSPORT",
            isActive: true,
          },
        });
      }
      const hashedpassword = await bcrypt.hash("password123", 12);
      user = await prisma.user.create({
        data: {
          email: "dispatcher@swift.com",
          password: hashedpassword,
          role: "TENANT_SUB_ADMIN",
          tenantId: tenant.id,
        },
        include: {
          tenant: true,
        },
      });
    }


    if (!user) {
      throw new Error('Invalid credentials');
    }
    //dont reveal if email exists security best practice

    const activeUser = user;
    if (!(activeUser as any).tenant) {
      const fullUser = await prisma.user.findUnique({
        where: { id: activeUser.id },
        include: { tenant: true },
      });
      if (fullUser) user = fullUser;
    }

    const validUser = user!;
    const isPasswordValid = await bcrypt.compare(password, validUser.password);

    //checking for wrong password 
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    if ((validUser as any).deletedAt) {
      throw new Error("This account has been deactivated. Please contact support.");
    }

    const token = generateToken(validUser);
    
    // Strip out the password hash before returning the user object
    const { password: _, ...userWithoutPassword } = validUser;

    return { user: userWithoutPassword, token };
  }

  async deleteAccount(userId: string, tenantId: string, reason?: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new Error("User account not found");
    }

    if ((user as any).deletedAt) {
      throw new Error("Account has already been deactivated");
    }

    const anonymizedEmail = `deleted_${userId.substring(0, 8)}_${Date.now()}@anonymized.invalid`;

    // Perform transaction: Archive compliance log + Soft delete & anonymize user PII
    await prisma.$transaction(async (tx) => {
      // 1. Write Snapshot to Encrypted Compliance Archive Vault
      await (tx as any).userComplianceArchive.create({
        data: {
          userId,
          originalEmail: user.email,
          tenantId: user.tenantId,
          anonymizedEmail,
          deletionReason: reason || "User requested account deletion via App Settings",
        },
      });

      // 2. Anonymize User Core Profile in Active DB
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          password: "ACCOUNT_DELETED_HASH",
          googleId: null,
          deletedAt: new Date(),
        },
      });
    });

    console.log(`[Compliance] Account ${userId} scrubbed and archived for compliance.`);
    return { success: true, message: "Account and personal data successfully deleted." };
  }
}

//Encapsulation  = hide complexity expose real functions

