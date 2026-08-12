import { PrismaClient, Role, Industry, DeliveryStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing data (in reverse order of dependencies)
  await prisma.delivery.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  console.log("🧹 Cleared old database records.");

  // Hash standard test password
  const hashedPassword = await bcrypt.hash("password123", 10);

  // ==========================================
  // 1. CREATE TENANTS (Logistics Companies)
  // ==========================================
  const tenantA = await prisma.tenant.create({
    data: {
      companyName: "Swift Logistics",
      subdomain: "swift",
      industry: Industry.TRANSPORT,
      isActive: true,
    },
  });

  const tenantB = await prisma.tenant.create({
    data: {
      companyName: "SafeCold Chain Movers",
      subdomain: "safecold",
      industry: Industry.FOOD,
      isActive: true,
    },
  });

  console.log("🏢 Created Tenants:", tenantA.companyName, "and", tenantB.companyName);

  // Create Platform Super Admin
  await prisma.user.create({
    data: {
      email: "superadmin@platform.com",
      password: hashedPassword,
      role: Role.PLATFORM_SUPER_ADMIN,
      tenantId: tenantA.id,
    },
  });

  // ==========================================
  // 2. CREATE TENANT A USERS (Swift Logistics)
  // ==========================================

  const swiftAdmin = await prisma.user.create({
    data: {
      email: "admin@swift.com",
      password: hashedPassword,
      role: Role.TENANT_SUPER_ADMIN,
      tenantId: tenantA.id,
    },
  });

  const swiftCustomer = await prisma.user.create({
    data: {
      email: "customer@swift.com",
      password: hashedPassword,
      role: Role.CUSTOMER,
      tenantId: tenantA.id,
    },
  });

  const swiftDriver1User = await prisma.user.create({
    data: {
      email: "driver1@swift.com",
      password: hashedPassword,
      role: Role.DRIVER,
      tenantId: tenantA.id,
    },
  });

  const swiftDriver2User = await prisma.user.create({
    data: {
      email: "driver2@swift.com",
      password: hashedPassword,
      role: Role.DRIVER,
      tenantId: tenantA.id,
    },
  });

  // ==========================================
  // 3. CREATE TENANT B USERS (SafeCold Chain)
  // ==========================================
  const safecoldAdmin = await prisma.user.create({
    data: {
      email: "admin@safecold.com",
      password: hashedPassword,
      role: Role.TENANT_SUPER_ADMIN,
      tenantId: tenantB.id,
    },
  });

  const safecoldDriverUser = await prisma.user.create({
    data: {
      email: "driver1@safecold.com",
      password: hashedPassword,
      role: Role.DRIVER,
      tenantId: tenantB.id,
    },
  });

  console.log("👤 Created User accounts.");

  // ==========================================
  // 4. CREATE DRIVER PROFILES (with location coordinates)
  // ==========================================
  // Driver 1: Near Surulere, Lagos (Bike)
  const driverSwift1 = await prisma.driverProfile.create({
    data: {
      userId: swiftDriver1User.id,
      vehicleType: "BIKE",
      licenseNumber: "DL-SWIFT-99123",
      isVerified: true,
      isOnline: true,
      lastLatitude: 6.5024,
      lastLongitude: 3.3585,
    },
  });

  // Driver 2: Near Ikeja, Lagos (Van)
  const driverSwift2 = await prisma.driverProfile.create({
    data: {
      userId: swiftDriver2User.id,
      vehicleType: "VAN",
      licenseNumber: "DL-SWIFT-88546",
      isVerified: true,
      isOnline: true,
      lastLatitude: 6.6018,
      lastLongitude: 3.3515,
    },
  });

  // Driver 3: Near Victoria Island, Lagos (Truck)
  const driverSafecold1 = await prisma.driverProfile.create({
    data: {
      userId: safecoldDriverUser.id,
      vehicleType: "TRUCK",
      licenseNumber: "DL-COLD-55462",
      isVerified: true,
      isOnline: true,
      lastLatitude: 6.4281,
      lastLongitude: 3.4219,
    },
  });

  console.log("🏍️ Created Driver Profiles and set active locations.");

  // ==========================================
  // 5. CREATE SAMPLE DELIVERIES
  // ==========================================
  // Order 1: Assigned to Driver 1 (Surulere to Yaba)
  await prisma.delivery.create({
    data: {
      tenantId: tenantA.id,
      senderId: swiftCustomer.id,
      driverId: driverSwift1.id,
      status: DeliveryStatus.ASSIGNED,
      pickupAddress: "Surulere Mall, Surulere, Lagos",
      pickupLatitude: 6.5020,
      pickupLongitude: 3.3580,
      senderPhone: "+2348011111111",
      dropoffAddress: "Herbert Macaulay Way, Yaba, Lagos",
      dropoffLatitude: 6.5182,
      dropoffLongitude: 3.3769,
      recipientName: "Tunde Bakare",
      recipientPhone: "+2348022222222",
      deliveryOtp: "542381",
    },
  });

  // Order 2: Pending order awaiting driver assignment (Ikeja to Maryland)
  await prisma.delivery.create({
    data: {
      tenantId: tenantA.id,
      senderId: swiftCustomer.id,
      status: DeliveryStatus.PENDING,
      pickupAddress: "Computer Village, Ikeja, Lagos",
      pickupLatitude: 6.5983,
      pickupLongitude: 3.3421,
      senderPhone: "+2348011111111",
      dropoffAddress: "Maryland Mall, Ikorodu Road, Lagos",
      dropoffLatitude: 6.5684,
      dropoffLongitude: 3.3704,
      recipientName: "Chidi Nze",
      recipientPhone: "+2348033333333",
      deliveryOtp: "983210",
    },
  });

  console.log("📦 Created sample orders (Assigned & Pending).");
  console.log("🌱 Database seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
