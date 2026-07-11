import {DeliveryStatus} from '@prisma/client'

export interface CreateDeliveryDTO{
    pickupAddress:string;
    pickupLatitude:number;
    pickupLongitude:number;
    senderPhone:string;
    dropoffAddress:string;
    dropoffLatitude:number;
    dropoffLongitude:number;
    recipientName:string;
    recipientPhone:string;
}


export interface UpdateDeliveryStatusDTO{
    status:DeliveryStatus;
    deliveryOtp?:string;
    actualDropoffLatitude?:number;
    actualDropoffLongitude?:number;
}

//required only when transitioning to delivered 


export interface IDriverAssignmentStrategy{
    findAndAssignDriver(
deliveryId:string,
tenantId:string,
pickupLat:number,
pickupLng:number

    ):Promise<string | null>;
}

 