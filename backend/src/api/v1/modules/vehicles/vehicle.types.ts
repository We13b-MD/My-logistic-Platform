import { VehicleType, VehicleStatus } from "@prisma/client";

export interface CreateVehicleDTO {
  plateNumber: string;
  vehicleType: VehicleType;
  status?: VehicleStatus;
  lastMaintenance?: string;
  nextMaintenanceDue?: string;
  driverId?: string;
}

export interface UpdateVehicleDTO {
  plateNumber?: string;
  vehicleType?: VehicleType;
  status?: VehicleStatus;
  lastMaintenance?: string;
  nextMaintenanceDue?: string;
  driverId?: string | null;
}

export interface AssignDriverDTO {
  driverId: string | null;
}

export interface VehicleFilterQuery {
  status?: VehicleStatus;
  vehicleType?: VehicleType;
  search?: string;
}

export interface VehicleResponse {
  id: string;
  tenantId: string;
  plateNumber: string;
  vehicleType: VehicleType;
  status: VehicleStatus;
  lastMaintenance: Date | null;
  nextMaintenanceDue: Date | null;
  isMaintenanceOverdue: boolean;
  driverId: string | null;
  driver?: {
    id: string;
    vehicleType: string;
    licenseNumber: string;
    user: {
      id: string;
      email: string;
    };
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
