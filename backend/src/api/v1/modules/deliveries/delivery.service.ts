import { prisma } from "../../../../config/prisma"
import { CreateDeliveryDTO, IDriverAssignmentStrategy } from './delivery.types';
import { DeliveryStatus } from '@prisma/client';
import crypto from 'crypto';
import { deliveryQueue } from './delivery.queue';
import { sendOtpEmail } from "../../../../utils/email.util";

export class NearestDriverStrategy implements IDriverAssignmentStrategy {
    async findAndAssignDriver(
        deliveryId: string,
        tenantId: string,
        pickupLat: number,
        pickupLng: number):
        Promise<string | null> {
        const latDelta = 0.1;
        const lngDelta = 0.1;

        // Atomic UPDATE + RETURNING using FOR UPDATE SKIP LOCKED.
        // This selects AND locks the nearest free driver in a single DB operation,
        // preventing two concurrent workers from assigning the same driver.
        const result = await prisma.$queryRaw<any[]>`
            UPDATE "DriverProfile"
            SET "updatedAt" = NOW()
            WHERE id = (
                SELECT dp.id
                FROM "DriverProfile" dp
                INNER JOIN "User" u ON dp."userId" = u.id
                WHERE u."tenantId" = ${tenantId}
                  AND dp."isOnline" = true
                  AND dp."isVerified" = true
                  AND dp."lastLatitude"  BETWEEN ${pickupLat - latDelta} AND ${pickupLat + latDelta}
                  AND dp."lastLongitude" BETWEEN ${pickupLng - lngDelta} AND ${pickupLng + lngDelta}
                  AND NOT EXISTS (
                      SELECT 1 FROM "Delivery" d
                      WHERE d."driverId" = dp.id
                        AND d.status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')
                  )
                ORDER BY (
                    6371 * acos(
                        cos(radians(${pickupLat})) * cos(radians(dp."lastLatitude")) *
                        cos(radians(dp."lastLongitude") - radians(${pickupLng})) +
                        sin(radians(${pickupLat})) * sin(radians(dp."lastLatitude"))
                    )
                ) ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id;
        `;

        // Guard: No free driver available in the bounding box
        if (result.length === 0) {
            return null;
        }

        const assignedDriverId = result[0].id;

        // Link the driver to the delivery and mark as ASSIGNED
        await prisma.delivery.update({
            where: { id: deliveryId },
            data: {
                driverId: assignedDriverId,
                status: DeliveryStatus.ASSIGNED,
            },
        });

        return assignedDriverId;
    }
}


export class DeliveryService {
    private matchingStrategy: IDriverAssignmentStrategy;

    constructor(matchingStrategy: IDriverAssignmentStrategy = new NearestDriverStrategy()) {
        this.matchingStrategy = matchingStrategy;
    }

    async create(senderId: string, tenantId: string, data: CreateDeliveryDTO) {
        const deliveryOtp = crypto.randomInt(100000, 999999).toString();

        const delivery = await prisma.delivery.create({
            data: {
                ...data, senderId, tenantId, deliveryOtp, status: DeliveryStatus.PENDING
            }
        });

        // Real-life OTP Email Dispatch: send OTP email to recipient or sender
        let targetEmail = (data as any).recipientEmail;
        if (!targetEmail) {
            const senderUser = await prisma.user.findUnique({ where: { id: senderId }, select: { email: true } });
            if (senderUser?.email) {
                targetEmail = senderUser.email;
            }
        }

        if (targetEmail) {
            sendOtpEmail(targetEmail, deliveryOtp, "DELIVERY_HANDOFF").catch((err) => {
                console.error("Failed to send real-life delivery OTP email:", err?.message || err);
            });
        }

        // Queue the driver-matching job in Redis (resilient, persistent, and auto-retryable)
        await deliveryQueue.add('MATCH_DRIVER', {
            deliveryId: delivery.id,
            tenantId,
            pickupLatitude: data.pickupLatitude,
            pickupLongitude: data.pickupLongitude,
        });

        return delivery;
    }

    async getById(deliveryId: string, tenantId: string) {
        const delivery = await prisma.delivery.findUnique({
            where: { id: deliveryId },
            include: {
                sender: { select: { email: true } },
                driver: { include: { user: { select: { email: true } } } }
            }
        });

        // Guard 1: delivery must exist
        if (!delivery) throw new Error("Delivery not found");

        // Guard 2: tenant isolation — a company cannot see another company's deliveries
        if (delivery.tenantId !== tenantId) throw new Error("Access Denied: Tenant Isolation Breach");

        return delivery;
    }

    async updateStatus(
        deliveryId: string,
        tenantId: string,
        newStatus: DeliveryStatus,
        providedOtp?: string,
        actualDropoffLatitude?: number,
        actualDropoffLongitude?: number,
        proofOfDeliveryPhotoUrl?: string,
        signaturePhotoUrl?: string,
    ) {
        // Wrap in a transaction with a conditional update to prevent TOCTOU race conditions.
        // If two requests arrive simultaneously, only one will succeed — the other gets count=0.
        return await prisma.$transaction(async (tx) => {
            // Step 1: Fetch delivery and run all validation guards
            const delivery = await tx.delivery.findUnique({
                where: { id: deliveryId }
            });

            if (!delivery) throw new Error('Delivery not found');
            if (delivery.tenantId !== tenantId) throw new Error('Access Denied: Tenant Isolation Breach');

            if (newStatus === DeliveryStatus.PICKED_UP) {
                if (delivery.status !== DeliveryStatus.ASSIGNED) {
                    throw new Error('Delivery must be assigned before it can be picked up');
                }
            }

            if (newStatus === DeliveryStatus.DELIVERED) {
                if (delivery.status !== DeliveryStatus.PICKED_UP && delivery.status !== DeliveryStatus.IN_TRANSIT) {
                    throw new Error('Delivery must be picked up or in transit before delivered');
                }
                if (!providedOtp) throw new Error('otp is required to complete a delivery');

                // Constant-time comparison to prevent timing attacks
                const otpMatches = crypto.timingSafeEqual(
                    Buffer.from(delivery.deliveryOtp),
                    Buffer.from(providedOtp)
                );
                if (!otpMatches) {
                    throw new Error('Invalid delivery otp');
                }
            }

            // Step 2: Conditional update — only succeeds if status hasn't changed since we read it.
            // This is the race condition fix: if a concurrent request already changed the status,
            // the WHERE clause won't match and count will be 0.
            const updatePayload: any = {
                status: newStatus,
                actualDropoffLatitude,
                actualDropoffLongitude,
            };

            if (proofOfDeliveryPhotoUrl) {
                updatePayload.proofOfDeliveryPhotoUrl = proofOfDeliveryPhotoUrl;
            }
            if (signaturePhotoUrl) {
                updatePayload.signaturePhotoUrl = signaturePhotoUrl;
            }

            const updated = await tx.delivery.updateMany({
                where: {
                    id: deliveryId,
                    status: delivery.status, // must still be the same status we read
                },
                data: updatePayload,
            });

            if (updated.count === 0) {
                throw new Error('Concurrent update conflict: delivery status was already changed by another request');
            }


            // Return the updated delivery record
            return tx.delivery.findUnique({ where: { id: deliveryId } });
        });
    }

    async list(
        tenantId: string,
        filters: {
            status?: DeliveryStatus;
            driverUserId?: string;
            senderId?: string;
            customerEmail?: string;
            limit?: number;
            page?: number;
        }
    ) {
        const limit = filters.limit || 10;
        const page = filters.page || 1;
        const skip = (page - 1) * limit;

        const whereClause: any = {
            tenantId,
        };

        if (filters.status) {
            whereClause.status = filters.status;
        }

        if (filters.driverUserId) {
            const driverProfile = await prisma.driverProfile.findUnique({
                where: { userId: filters.driverUserId }
            });

            if (!driverProfile) {
                throw new Error('Driver profile not found');
            }

            whereClause.driverId = driverProfile.id;
        }

        if (filters.senderId) {
            whereClause.OR = [
                { senderId: filters.senderId },
                { recipientEmail: filters.customerEmail || "" }
            ];
        }

        const [deliveries, total] = await Promise.all([
            prisma.delivery.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    sender: {
                        select: { email: true }
                    },
                    driver: {
                        include: {
                            user: {
                                select: {
                                    email: true
                                }
                            }
                        }
                    },
                }
            }),
            prisma.delivery.count({
                where: whereClause
            })
        ]);

        return {
            deliveries,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
