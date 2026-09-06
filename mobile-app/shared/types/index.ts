/**
 * Shared Type Definitions for Logistel Mobile Applications
 */

export type UserRole = 'DRIVER_PROFILE' | 'CUSTOMER' | 'TENANT_SUPER_ADMIN' | 'TENANT_SUB_ADMIN' | 'PLATFORM_SUPER_ADMIN';

export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export interface LocationPing {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

export interface AuthSession {
  token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    tenantId: string;
  };
}
