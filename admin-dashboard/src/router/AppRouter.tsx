import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';

// Auth pages
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { TenantOnboardPage } from '@/features/auth/pages/TenantOnboardPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';

// Placeholder dashboard pages (replace with real pages as they are built)
import { UnauthorizedPage } from '@/features/auth/pages/UnauthorizedPage';
import { TenantDashboardPage } from '@/features/dashboard/pages/TenantDashboardPage';
import { DriverDashboardPage } from '@/features/dashboard/pages/DriverDashboardPage';
import { PlatformDashboardPage } from '@/features/dashboard/pages/PlatformDashboardPage';
import { CustomerDashboardPage } from '@/features/dashboard/pages/CustomerDashboardPage';
import { TenantStaffDashboardPage } from '@/features/dashboard/pages/TenantStaffDashboardPage';

import { PublicTrackingPage } from '@/features/tracking/pages/PublicTrackingPage';

// Role-based dashboard home redirect

function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'PLATFORM_SUPER_ADMIN':
    case 'PLATFORM_SUB_ADMIN':
      return <Navigate to="/platform/dashboard" replace />;
    case 'TENANT_SUPER_ADMIN':
      return <Navigate to="/tenant-owner/dashboard" replace />;
    case 'TENANT_SUB_ADMIN':
      return <Navigate to="/tenant-staff/dashboard" replace />;
    case 'DRIVER':
      return <Navigate to="/driver/dashboard" replace />;
    case 'CUSTOMER':
      return <Navigate to="/customer/dashboard" replace />;
    default:
      return <Navigate to="/unauthorized" replace />;
  }
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ─── Public Tracking Routes (No Auth Required) ─── */}
        <Route path="/track" element={<PublicTrackingPage />} />
        <Route path="/track/:code" element={<PublicTrackingPage />} />

        {/* ─── Public Auth Routes ─── */}

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboard" element={<TenantOnboardPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ─── Protected: Redirect to role dashboard ─── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardRedirect />} />

          {/* Platform Admin Routes */}
          <Route element={<RoleRoute allowedRoles={['PLATFORM_SUPER_ADMIN', 'PLATFORM_SUB_ADMIN']} />}>
            <Route path="/platform/dashboard" element={<PlatformDashboardPage />} />
          </Route>


          {/* Tenant Super Admin Routes */}
          <Route element={<RoleRoute allowedRoles={['TENANT_SUPER_ADMIN']} />}>
            <Route path="/tenant-owner/dashboard" element={<TenantDashboardPage />} />
          </Route>

          {/* Tenant Sub Admin Routes */}
          <Route element={<RoleRoute allowedRoles={['TENANT_SUB_ADMIN']} />}>
            <Route path="/tenant-staff/dashboard" element={<TenantStaffDashboardPage />} />
          </Route>


          {/* Driver Routes */}
          <Route element={<RoleRoute allowedRoles={['DRIVER']} />}>
            <Route path="/driver/dashboard" element={<DriverDashboardPage />} />
          </Route>

          {/* Customer Routes */}
          <Route element={<RoleRoute allowedRoles={['CUSTOMER']} />}>
            <Route path="/customer/dashboard" element={<CustomerDashboardPage />} />
          </Route>
        </Route>


        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
