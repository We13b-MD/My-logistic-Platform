import { prisma } from "../../../../config/prisma"
import { CreateDeliveryDTO, IDriverAssignmentStrategy } from './delivery.types';
import { DeliveryStatus } from '@prisma/client';
import crypto from 'crypto';
import { deliveryQueue } from './delivery.queue';

export class NearestDriverStrategy implements IDriverAssignmentStrategy {
    async findAndAssignDriver(
        deliveryId: string,
        tenantId: string,
        pickupLat: number,
        pickupLng: number):
        Promise<string | null> {
        const latDelta = 0.1;
        const lngDelta = 0.1;

        // Raw SQL using Haversine formula to find the nearest available driver
        const closestDrivers = await prisma.$queryRaw<any[]>`
            SELECT dp.id,
              (6371 * acos(
                cos(radians(${pickupLat})) * cos(radians(dp."lastLatitude")) *
                cos(radians(dp."lastLongitude") - radians(${pickupLng})) +
                sin(radians(${pickupLat})) * sin(radians(dp."lastLatitude"))
              )) AS distance
            FROM "DriverProfile" dp
            INNER JOIN "User" u ON dp."userId" = u.id
            WHERE u."tenantId" = ${tenantId}
              AND dp."isOnline" = true
              AND dp."isVerified" = true
              AND dp."lastLatitude" BETWEEN ${pickupLat - latDelta} AND ${pickupLat + latDelta}
              AND dp."lastLongitude" BETWEEN ${pickupLng - lngDelta} AND ${pickupLng + lngDelta}
            ORDER BY distance ASC
            LIMIT 1;
        `;

        // Guard: No drivers available in the bounding box area
        if (closestDrivers.length === 0) {
            return null;
        }

        const assignedDriverId = closestDrivers[0].id;

        // Update the delivery record: link the driver and change status to ASSIGNED
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
    ) {
        const delivery = await prisma.delivery.findUnique({
            where: { id: deliveryId }
        });
        if (!delivery) throw new Error('Delivery not found');
        if (delivery.tenantId !== tenantId) throw new Error('Access Denied: Tenant Isolation Breach');
        if (newStatus === DeliveryStatus.PICKED_UP) {
            if (delivery.status !== DeliveryStatus.ASSIGNED) {
                throw new Error('Delivery must be assigned before it can be picked up')
            }
        }
        if (newStatus === DeliveryStatus.DELIVERED) {
            if (delivery.status !== DeliveryStatus.PICKED_UP && delivery.status !== DeliveryStatus.IN_TRANSIT) {
                throw new Error('Delivery must be picked up or in transit before delivered ');
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

        // Apply status transition and save actual drop-off coordinates (if provided)
        return await prisma.delivery.update({
            where: { id: deliveryId },
            data: {
                status: newStatus,
                actualDropoffLatitude,
                actualDropoffLongitude,
            },
        });
    }

    async list(
        tenantId: string,
        filters: {
            status?: DeliveryStatus;
            driverUserId?: string;
            senderId?: string;
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
            whereClause.senderId = filters.senderId;
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

