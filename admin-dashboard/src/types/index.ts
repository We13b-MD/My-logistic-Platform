// Shared TypeScript types across the entire frontend

export type Role =
  | 'CUSTOMER'
  | 'DRIVER'
  | 'TENANT_SUB_ADMIN'
  | 'TENANT_SUPER_ADMIN'
  | 'PLATFORM_SUB_ADMIN'
  | 'PLATFORM_SUPER_ADMIN';

export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

export type VehicleType = 'BIKE' | 'VAN' | 'TRUCK' | 'CAR';

export type Industry =
  | 'FOOD'
  | 'HEALTH'
  | 'TRANSPORT'
  | 'FASHION'
  | 'SPORT'
  | 'ENTERTAINMENT'
  | 'BANKING'
  | 'OTHERS';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  companyName: string;
  subdomain: string;
  logoUrl?: string;
  isActive: boolean;
  industry: Industry;
  createdAt: string;
  updatedAt: string;
}

export interface DriverProfile {
  id: string;
  userId: string;
  vehicleType: VehicleType;
  licenseNumber: string;
  isVerified: boolean;
  isOnline: boolean;
  lastLatitude?: number;
  lastLongitude?: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    role: Role;
    tenantId: string;
  };
}

export interface Delivery {
  id: string;
  tenantId: string;
  senderId: string;
  driverId?: string;
  status: DeliveryStatus;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  senderPhone: string;
  dropoffAddress: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  recipientName: string;
  recipientPhone: string;
  deliveryOtp: string;
  proofOfDeliveryPhotoUrl?: string;
  signaturePhotoUrl?: string;
  expectedDeliveryTime?: string;
  createdAt: string;
  updatedAt: string;
  sender?: { email: string };
  driver?: DriverProfile;
}


export interface PlatformTenantItem {
  id: string;
  companyName: string;
  subdomain: string;
  logoUrl?: string;
  isActive: boolean;
  industry: Industry;
  createdAt: string;
  adminEmail: string;
  totalUsers: number;
  totalDeliveries: number;
  totalVehicles: number;
}

export interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalDrivers: number;
  totalDeliveries: number;
  completedDeliveries: number;
}

export interface DashboardMetricsData {
  operationsOverview: {
    activeDeliveries: number;
    completedToday: number;
    pending: number;
    delayed: number;
  };
  onTimeRate: {
    percentage: number;
    trend: string;
  };
  fleetStatus: {
    inUse: number;
    idle: number;
    maintenance: number;
  };
  alerts: Array<{
    type: 'DELIVERY_DELAY' | 'MAINTENANCE_DUE' | 'DRIVER_INACTIVE' | 'LOW_FUEL';

    message: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

export interface PaginationMeta {

  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type VehicleStatus = 'IDLE' | 'IN_USE' | 'MAINTENANCE';

export interface Vehicle {
  id: string;
  tenantId: string;
  plateNumber: string;
  vehicleType: VehicleType;
  status: VehicleStatus;
  lastMaintenance: string | null;
  nextMaintenanceDue: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleInput {
  plateNumber: string;
  vehicleType: VehicleType;
  status?: VehicleStatus;
  lastMaintenance?: string;
  nextMaintenanceDue?: string;
  driverId?: string;
}

export interface UpdateVehicleInput {
  plateNumber?: string;
  vehicleType?: VehicleType;
  status?: VehicleStatus;
  lastMaintenance?: string;
  nextMaintenanceDue?: string;
  driverId?: string | null;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  meta?: PaginationMeta;
}


