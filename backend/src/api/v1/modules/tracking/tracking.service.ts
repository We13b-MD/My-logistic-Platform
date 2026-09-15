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
        const result = await this.repository.getBreadcrumbTrail(deliveryId, tenantId);

        if (result === null) {
            throw new Error('Delivery not found or access denied');
        }

        const { delivery, breadcrumbs } = result;

        // Haversine distance calculator in meters
        const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
            const R = 6371e3; // Earth radius in meters
            const toRad = (deg: number) => (deg * Math.PI) / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        // Determine driver's current position: latest breadcrumb or driver profile or pickup anchor
        const latestBreadcrumb = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
        const driverLat = delivery.driver?.lastLatitude ?? (latestBreadcrumb ? latestBreadcrumb.latitude : delivery.pickupLatitude);
        const driverLng = delivery.driver?.lastLongitude ?? (latestBreadcrumb ? latestBreadcrumb.longitude : delivery.pickupLongitude);

        // Distance calculations
        let distanceFromPickupMeters = 0;
        let distanceFromDropoffMeters = 0;
        if (driverLat !== null && driverLng !== null) {
            distanceFromPickupMeters = Math.round(haversineMeters(driverLat, driverLng, delivery.pickupLatitude, delivery.pickupLongitude));
            distanceFromDropoffMeters = Math.round(haversineMeters(driverLat, driverLng, delivery.dropoffLatitude, delivery.dropoffLongitude));
        }

        // Tier 4 Geofencing State: Has the driver departed the pickup location?
        let geofenceStatus: 'AT_PICKUP' | 'DEPARTED_PICKUP' | 'EN_ROUTE' | 'ARRIVED_DROPOFF' = 'AT_PICKUP';
        if (distanceFromDropoffMeters <= 250) {
            geofenceStatus = 'ARRIVED_DROPOFF';
        } else if (distanceFromPickupMeters > 300) {
            geofenceStatus = 'DEPARTED_PICKUP';
        } else {
            geofenceStatus = 'AT_PICKUP';
        }

        // Tier 2 Watchdog Sentinel: calculate recency of telemetry
        const lastPingTime = delivery.driver?.updatedAt ? new Date(delivery.driver.updatedAt).getTime() : 0;
        const now = Date.now();
        const secondsSinceLastPing = lastPingTime > 0 ? Math.floor((now - lastPingTime) / 1000) : 999999;

        let telemetryStatus: 'LIVE_STREAMING' | 'SIGNAL_LOST' | 'INITIAL_ANCHOR' = 'INITIAL_ANCHOR';
        if (secondsSinceLastPing <= 120 && delivery.driver?.isOnline) {
            telemetryStatus = 'LIVE_STREAMING';
        } else if (['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(delivery.status)) {
            telemetryStatus = breadcrumbs.length > 1 ? 'SIGNAL_LOST' : 'INITIAL_ANCHOR';
        }

        // Ensure trail points array is never empty if we have driver/pickup coordinates
        let trailPoints = breadcrumbs.map(point => ({
            lat: point.latitude,
            lng: point.longitude,
            recordedAt: point.recordedAt,
        }));

        if (trailPoints.length === 0 && driverLat !== null && driverLng !== null) {
            trailPoints = [{
                lat: driverLat,
                lng: driverLng,
                recordedAt: new Date(),
            }];
        }

        return {
            deliveryId,
            status: delivery.status,
            totalPoints: trailPoints.length,
            trail: trailPoints,
            pickup: {
                address: delivery.pickupAddress,
                lat: delivery.pickupLatitude,
                lng: delivery.pickupLongitude,
            },
            dropoff: {
                address: delivery.dropoffAddress,
                lat: delivery.dropoffLatitude,
                lng: delivery.dropoffLongitude,
            },
            driver: delivery.driver ? {
                id: delivery.driver.id,
                name: delivery.driver.user.email.split('@')[0],
                email: delivery.driver.user.email,
                lastLatitude: driverLat,
                lastLongitude: driverLng,
                lastPingAt: delivery.driver.updatedAt,
                secondsSinceLastPing,
                isOnline: delivery.driver.isOnline,
                vehicle: delivery.driver.vehicle,
            } : null,
            geofence: {
                status: geofenceStatus,
                distanceFromPickupMeters,
                distanceFromDropoffMeters,
                departedPickup: geofenceStatus !== 'AT_PICKUP',
                description: geofenceStatus === 'AT_PICKUP'
                    ? `At pickup origin (within ${distanceFromPickupMeters}m)`
                    : geofenceStatus === 'DEPARTED_PICKUP'
                    ? `Departed pickup (${(distanceFromPickupMeters / 1000).toFixed(1)} km away)`
                    : `Arrived at delivery destination`,
            },
            telemetry: {
                status: telemetryStatus,
                secondsSinceLastPing,
                description: telemetryStatus === 'LIVE_STREAMING'
                    ? 'Live GPS stream active (real-time)'
                    : telemetryStatus === 'SIGNAL_LOST'
                    ? `Telemetry interrupted (last seen ${Math.floor(secondsSinceLastPing / 60)}m ago)`
                    : 'Awaiting first on-road telemetry ping',
            }
        };
    }
}
