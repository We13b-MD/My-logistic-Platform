import { TrackingRepository } from "./tracking.repository";

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
}