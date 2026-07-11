/*
  Warnings:

  - The values [ADMIN] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `tenantId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('FOOD', 'HEALTH', 'TRANSPORT', 'FASHION', 'SPORT', 'ENTERTAINMENT', 'BANKING', 'OTHERS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('CUSTOMER', 'DRIVER', 'TENANT_SUB_ADMIN', 'TENANT_SUPER_ADMIN', 'PLATFORM_SUB_ADMIN', 'PLATFORM_SUPER_ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "industry" "Industry" NOT NULL DEFAULT 'OTHERS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "driverId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "pickupAddress" TEXT NOT NULL,
    "pickupLatitude" DOUBLE PRECISION NOT NULL,
    "pickupLongitude" DOUBLE PRECISION NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffLatitude" DOUBLE PRECISION NOT NULL,
    "dropoffLongitude" DOUBLE PRECISION NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "deliveryOtp" TEXT NOT NULL,
    "proofOfDeliveryPhotoUrl" TEXT,
    "signaturePhotoUrl" TEXT,
    "actualDropoffLatitude" DOUBLE PRECISION,
    "actualDropoffLongitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "Tenant"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "DriverProfile"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
