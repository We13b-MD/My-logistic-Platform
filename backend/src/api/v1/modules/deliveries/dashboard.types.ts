export interface IDashboardMetrics{
    operationsOverview:{
        activeDeliveries:number;
        completedToday:number;
pending:number;
     delayed:number;
    };

    onTimeRate:{
        percentage:number;
        trend:string;
    };
    fleetStatus:{
        inUse:number;
        idle:number;
        maintenance:number;
    };
    alerts:Array<{
        type: "DELIVERY_DELAY" | "MAINTENANCE_DUE" | "DRIVER_INACTIVE";
    message: string;
    severity: "HIGH" | "MEDIUM";
    }>;
}