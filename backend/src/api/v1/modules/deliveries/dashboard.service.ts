import { prisma } from "../../../../config/prisma";
import { IDashboardMetrics } from "./dashboard.types";
import { DeliveryStatus, VehicleStatus } from "@prisma/client"

export class DashBoardService {
    async getMetrics(tenantId: string): Promise<IDashboardMetrics> {
        const now = new Date();
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        const [activeCount,
            completedTodayCount,
            pendingCount,
            delayedCount,
            vehiclesInUseCount,
            vehiclesIdleCount,
            vehiclesMaintenanceCount,
            totalCompletedCount,
            onTimeCompletedRaw,
            delayedDeliveriesList,
            maintenanceVehiclesList,
            inactiveDriversList
        ] = await Promise.all([
            prisma.delivery.count({
                where: {
                    tenantId,
                    status: {
                        in: [
                            DeliveryStatus.ASSIGNED,
                            DeliveryStatus.PICKED_UP,
                            DeliveryStatus.IN_TRANSIT
                        ],
                    }
                }
            }),

            //count deliveries completed today

            prisma.delivery.count({
                where: {
                    tenantId,
                    status: DeliveryStatus.DELIVERED,
                    updatedAt: {
                        gte: startOfToday
                    }
                }
            }),

            prisma.delivery.count({
                where: {
                    tenantId,
                    status:
                        DeliveryStatus.PENDING,
                }
            }),
            //Count delayed deliveries (past deadline but not yet delivered or cancelled)
            prisma.delivery.count({
                where: {
                    tenantId,
                    expectedDeliveryTime: {
                        lt: now,
                    },
                    status: {
                        notIn: [
                            DeliveryStatus.DELIVERED,
                            DeliveryStatus.CANCELLED,
                        ]
                    }
                }
            }),

            //count vehicles in use
            prisma.vehicle.count({
                where: {
                    tenantId,
                    status: VehicleStatus.IN_USE,
                },
            }),

            //Count vehicles idle
            prisma.vehicle.count({
                where: {
                    tenantId,
                    status: VehicleStatus.IDLE,
                },
            }),

            //count vehicles in maintenance
            prisma.vehicle.count({
                where: {
                    tenantId,
                    status: VehicleStatus.MAINTENANCE
                }
            }),

            //total completed deliveries(for on -time rate -denominator)

            prisma.delivery.count({
                where: {
                    tenantId,
                    status: DeliveryStatus.DELIVERED,
                }
            }),
            //on time completed deliveries (where completed <= expected deadline) we are using raw queries

            prisma.$queryRaw<Array<{ count: number }>>`
   SELECT COUNT(*)::int AS count
    FROM "Delivery"
    WHERE "tenantId" = ${tenantId}
      AND "status" = 'DELIVERED'
      AND "updatedAt" <= "expectedDeliveryTime"`,

            //top 3 delayed deliveries

            prisma.delivery.findMany({
                where: {
                    tenantId,
                    expectedDeliveryTime: {
                        lt: now
                    },
                    status: {
                        notIn: [
                            DeliveryStatus.DELIVERED,
                            DeliveryStatus.CANCELLED
                        ]
                    }
                },
                select: { id: true, recipientName: true },
                take: 3
            }),

            // fetch top 3 vehicles with maintenance due within the next 3 days 
            prisma.vehicle.findMany({
                where: {
                    tenantId,
                    nextMaintenanceDue: {
                        lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                    }
                },
                select: {
                    plateNumber: true,
                    nextMaintenanceDue: true,
                },
                take: 3
            }),

            // 12. Fetch top 3 online drivers who haven't updated their location in the last 2 hours

            prisma.driverProfile.findMany({
                where: {
                    user: { tenantId },
                    isOnline: true,
                    updatedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
                },
                select: {
                    id: true, user: {
                        select: { email: true }
                    }
                },
                take: 3
            })

        ])

        const onTimeCompletedCount = onTimeCompletedRaw[0].count || 0;


        //calculate On-Time Rate percentage safely(avoid divide by zero)
        const onTimeRangePercentage = totalCompletedCount > 0 ? Math.round((onTimeCompletedCount / totalCompletedCount) * 100)
            : 100;
        //format real alerts based on database queries 

        const alerts: IDashboardMetrics['alerts'] = [];
        delayedDeliveriesList.forEach(delivery => {
            alerts.push({
                type: 'DELIVERY_DELAY',
                message: `Delivery to ${delivery.recipientName} is delayed`,
                severity: 'HIGH'

            })
        })

        maintenanceVehiclesList.forEach(vehicle => {
            alerts.push({
                type: 'MAINTENANCE_DUE',
                message: `Vehicle ${vehicle.plateNumber} is due for maintenance.`,
                severity: 'MEDIUM'
            })
        })

        inactiveDriversList.forEach(driver => {
            alerts.push({
                type: 'DRIVER_INACTIVE',
                message: `Driver ${driver.user.email} is online but has been inactive for 2hours.`,
                severity: 'MEDIUM'
            })
        });

        return {
            operationsOverview: {
                activeDeliveries: activeCount,
                completedToday: completedTodayCount,
                pending: pendingCount,
                delayed: delayedCount
            },
            onTimeRate: {
                percentage: onTimeRangePercentage,
                trend: "+1.8% vs last week"
            },

            fleetStatus:{
                inUse:vehiclesInUseCount,
                idle:vehiclesIdleCount,
                maintenance:vehiclesMaintenanceCount
            },
            alerts
        }
    }
}

