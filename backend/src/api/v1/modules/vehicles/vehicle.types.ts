import { VehicleType, VehicleStatus } from "@prisma/client";

export interface CreateVehicleDTO {
  plateNumber: string;
  vehicleType: VehicleType;
  status?: VehicleStatus;
  lastMaintenance?: string;
  nextMaintenanceDue?: string;
  insuranceExpiry?: string | null;
  roadworthinessExpiry?: string | null;
  vehicleLicenseExpiry?: string | null;
  hackneyPermitExpiry?: string | null;
  driverId?: string;
}

export interface UpdateVehicleDTO {
  plateNumber?: string;
  vehicleType?: VehicleType;
  status?: VehicleStatus;
  lastMaintenance?: string;
  nextMaintenanceDue?: string;
  insuranceExpiry?: string | null;
  roadworthinessExpiry?: string | null;
  vehicleLicenseExpiry?: string | null;
  hackneyPermitExpiry?: string | null;
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

export interface ComplianceDocStatus {
  name: string;
  key: "insurance" | "roadworthiness" | "vehicleLicense" | "hackneyPermit";
  date: Date | null;
  status: "EXPIRED" | "EXPIRING_SOON" | "VALID" | "NOT_SET";
  daysRemaining: number | null;
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
  insuranceExpiry: Date | null;
  roadworthinessExpiry: Date | null;
  vehicleLicenseExpiry: Date | null;
  hackneyPermitExpiry: Date | null;
  complianceDocs: ComplianceDocStatus[];
  hasExpiredDocs: boolean;
  hasExpiringSoonDocs: boolean;
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

