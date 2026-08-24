import {prisma} from '../../../../config/prisma'

export class TrackingRepository{
    //fetches the location of the driver assigend to a specific delivery,
    //verifying tenant isolation 

    async getDeliveryDriverLocation(deliveryId: string, tenantId: string){
       return prisma.delivery.findFirst({
        where: {
            id:deliveryId,
            tenantId:tenantId
        },
        select: {
          id:true,
          status:true,
          driver: {
            select: {
                id:true,
                isOnline: true,
                lastLatitude: true,
                lastLongitude: true,
                updatedAt: true,
                user: {
                    select: {
                      email:true,
                    }
                }
            }
          }
        }

       })
    }



    //Fetches all verified, online drivers cordinntes for a tenant.


    async getActiveDriverLocations(tenantId: string){
        return prisma.driverProfile.findMany({
           where: {
            isOnline: true,
            isVerified: true,
            user: {
                tenantId: tenantId,
            },

           },
           select:{
            id: true,
            lastLatitude: true,
            lastLongitude: true,
            updatedAt: true,
            user: {
                select: {
                    id: true,
                    email: true,
                    
                }
            }
           }

        })
    }

    // fetches a driver profileId linked to a user ID



    async getDriverProfileId(userId: string){
        return prisma.driverProfile.findUnique({
            where: {userId},
            select: {id :true}
        });
    }

    //updates driver coordinates and marks them as online 

    async updateDriverLocation(driverProfileId: string, latitude: number, longitude: number){
        return prisma.driverProfile.update({
            where:{id: driverProfileId},
            data: {
                lastLatitude: latitude,
                lastLongitude: longitude,
                isOnline: true,
            },
        })
    }

    //fetches active deliveries a driver is currently assigned to 

    async getActiveDeliveriesForDriver(driverProfileId:string){
        return prisma.delivery.findMany({
            where: {
                driverId: driverProfileId,
                status: {
                    in: ["ASSIGNED", "PICKED_UP" ],
                }
            },

            select: {
                id :true ,
            }
        })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GPS Breadcrumb Trail Methods (Gap 1 — Cargo Diversion Prevention)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * saveBreadcrumb
     * Inserts a single, permanent GPS point for a driver+delivery pair.
     * Called on EVERY driver_location_update socket event.
     * Rows are NEVER overwritten — this is an append-only audit trail.
     */
    async saveBreadcrumb(
        driverProfileId: string,
        deliveryId: string,
        latitude: number,
        longitude: number
    ) {
        return prisma.locationBreadcrumb.create({
            data: {
                driverId:   driverProfileId,
                deliveryId: deliveryId,
                latitude,
                longitude,
                // recordedAt defaults to now() in the database
            },
        });
    }

    /**
     * getBreadcrumbTrail
     * Returns the complete ordered GPS history for a delivery.
     * Used by admins to replay the exact route on a map and investigate
     * cargo diversion or transloading fraud.
     */
    async getBreadcrumbTrail(deliveryId: string, tenantId: string) {
        // First verify the delivery belongs to this tenant (security isolation)
        const delivery = await prisma.delivery.findFirst({
            where: { id: deliveryId, tenantId },
            select: { id: true },
        });

        if (!delivery) return null;

        return prisma.locationBreadcrumb.findMany({
            where: { deliveryId },
            orderBy: { recordedAt: 'asc' }, // oldest first → draws trail in correct direction
            select: {
                id:         true,
                latitude:   true,
                longitude:  true,
                recordedAt: true,
            },
        });
    }
}