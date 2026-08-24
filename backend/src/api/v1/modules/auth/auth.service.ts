import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../../../../config/prisma";
import { generateToken } from "../../../../utils/jwt";
import { RegisterDTO } from "./auth.types";
import { Role } from "@prisma/client";
import { sendOtpEmail } from "../../../../utils/email.util";

export class AuthService {
  async requestOtp(email: string) {
    if (!email || !email.includes("@")) {
      throw new Error("Please provide a valid email address.");
    }
    const otpCode = crypto.randomInt(100000, 999999).toString();
    await sendOtpEmail(email, otpCode, "VERIFICATION");
    return { email, otpCode };
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
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Generate JWT token for immediate login after register
    const token = generateToken(user);

    return { user, token };
  }

  async login(data: { email: string; password: string }) {
    const { email, password } = data;

    let user = await prisma.user.findUnique({
      where: { email },
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
      });
    }


    if (!user) {
      throw new Error('Invalid credentials');
    }
    //dont reveal if email exists security best practice

    const isPasswordValid = await bcrypt.compare(password, user.password);

    //checking for wrong password 
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }


    const token = generateToken(user);
    
    // Strip out the password hash before returning the user object
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }
}

//Encapsulation  = hide complexity expose real functions

