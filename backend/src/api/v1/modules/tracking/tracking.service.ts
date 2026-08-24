import { TrackingRepository } from "./tracking.repository";
import { prisma } from "../../../../config/prisma";


export class TrackingService{
    private repository: TrackingRepository;

    constructor(repository:TrackingRepository = new TrackingRepository()){
        this.repository = repository;
    }

    //Retrieves the location of the driver assigned to delivery 

    async getDeliveryDriverLocation(deliveryId: string, tenantId: string){
        const delivery = await this.repository.getDeliveryDriverLocation(deliveryId, tenantId)

        if(!delivery){
            throw new Error('Delivery not found or unauthorized')
        }
        

        if(!delivery.driver){
            throw new Error('No driver has been assigned delivery yet ');
        }
        return {
            deliveryId: delivery.id,
            status: delivery.status,
            driver: {
                id: delivery.driver.id,
                email: delivery.driver.user.email,
                latitude: delivery.driver.lastLatitude,
                longitude: delivery.driver.lastLongitude,
                isOnline: delivery.driver.isOnline,
                updatedAt: delivery.driver.updatedAt,
            }
        }
    }


    //Retrieve all  active oline drivers  locations for  tenant

    async getActiveDriversLocations(tenantId: string){
        const drivers = await this.repository.getActiveDriverLocations(tenantId);

        return drivers.map((driver)=>({
            id: driver.id,
            email: driver.user.email,
            latitude:driver.lastLatitude,
            longitude: driver.lastLongitude,
            updatedAt: driver.updatedAt
        }))
    }

    /**
     * Unauthenticated public tracking query by OTP or Delivery ID.
     */
    async getPublicTrackingInfo(code: string) {
        const trimmedCode = code.trim();
        const delivery = await prisma.delivery.findFirst({
            where: {
                OR: [
                    { deliveryOtp: trimmedCode },
                    { id: trimmedCode },
                ],
            },
            include: {
                tenant: {
                    select: { companyName: true, logoUrl: true }
                },
                driver: {
                    include: {
                        user: { select: { email: true } }
                    }
                }
            }
        });

        if (!delivery) {
            throw new Error("No shipment found matching this tracking code or OTP");
        }

        return {
            id: delivery.id,
            status: delivery.status,
            companyName: delivery.tenant?.companyName || "Swift Logistics",
            pickupAddress: delivery.pickupAddress,
            pickupLatitude: delivery.pickupLatitude,
            pickupLongitude: delivery.pickupLongitude,
            dropoffAddress: delivery.dropoffAddress,
            dropoffLatitude: delivery.dropoffLatitude,
            dropoffLongitude: delivery.dropoffLongitude,
            recipientName: delivery.recipientName,
            expectedDeliveryTime: delivery.expectedDeliveryTime,
            proofOfDeliveryPhotoUrl: delivery.proofOfDeliveryPhotoUrl,
            signaturePhotoUrl: delivery.signaturePhotoUrl,
            driver: delivery.driver
                ? {
                    vehicleType: delivery.driver.vehicleType,
                    licenseNumber: delivery.driver.licenseNumber,
                    isOnline: delivery.driver.isOnline,
                    latitude: delivery.driver.lastLatitude,
                    longitude: delivery.driver.lastLongitude,
                }
                : null,
            createdAt: delivery.createdAt,
            updatedAt: delivery.updatedAt,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GPS Breadcrumb Trail (Gap 1 — Cargo Diversion Prevention)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * getBreadcrumbTrail
     * Returns the full ordered GPS history of a delivery for admin map replay.
     * Admins can use this to investigate cargo diversion or transloading fraud
     * by seeing the exact path the vehicle took, including any unauthorized stops.
     */
    async getBreadcrumbTrail(deliveryId: string, tenantId: string) {
        const trail = await this.repository.getBreadcrumbTrail(deliveryId, tenantId);

        if (trail === null) {
            throw new Error('Delivery not found or access denied');
        }

        return {
            deliveryId,
            totalPoints: trail.length,
            // Return as [lat, lng] pairs — ready for Leaflet Polyline positions
            trail: trail.map(point => ({
                lat:        point.latitude,
                lng:        point.longitude,
                recordedAt: point.recordedAt,
            })),
        };
    }
}
