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
  tenant?: Tenant;
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
  recipientEmail?: string | null;
  distanceKm?: number | null;
  estimatedPrice?: number | null;
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

export interface ComplianceDoc {
  name: string;
  key: string;
  date: string | null;
  status: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NOT_SET';
  daysRemaining: number | null;
}

export interface Vehicle {
  id: string;
  tenantId: string;
  plateNumber: string;
  vehicleType: VehicleType;
  status: VehicleStatus;
  lastMaintenance: string | null;
  nextMaintenanceDue: string | null;
  isMaintenanceOverdue: boolean;
  insuranceExpiry?: string | null;
  roadworthinessExpiry?: string | null;
  vehicleLicenseExpiry?: string | null;
  hackneyPermitExpiry?: string | null;
  complianceDocs?: ComplianceDoc[];
  hasExpiredDocs?: boolean;
  hasExpiringSoonDocs?: boolean;
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
  insuranceExpiry?: string | null;
  roadworthinessExpiry?: string | null;
  vehicleLicenseExpiry?: string | null;
  hackneyPermitExpiry?: string | null;
  driverId?: string;
}

export interface UpdateVehicleInput {
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

export interface DriverRemittance {
  id: string;
  tenantId: string;
  driverId: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt: string;
  driver?: {
    user: {
      email: string;
    };
  };
}

export interface DriverRemittanceSummaryItem {
  driverId: string;
  driverEmail: string;
  vehicleType: string;
  licenseNumber: string;
  isOnline: boolean;
  completedDeliveries: number;
  totalCollected: number;
  totalRemitted: number;
  pendingBalance: number;
  recentRemittances: DriverRemittance[];
}

export interface FleetRemittanceSummary {
  fleetTotalCollected: number;
  fleetTotalRemitted: number;
  fleetPendingBalance: number;
  driverBreakdowns: DriverRemittanceSummaryItem[];
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  meta?: PaginationMeta;
}



