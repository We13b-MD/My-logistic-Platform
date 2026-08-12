import apiClient from '@/utils/axios';
import { Industry } from '@/types';

export const tenantApi = {
  // Onboard a new logistics company + create its first TENANT_SUPER_ADMIN
  onboard: (data: {
    companyName: string;
    subdomain: string;
    industry: Industry;
    adminEmail: string;
    adminPassword: string;
  }) => apiClient.post('/tenants/onboard', data),

  getBySubdomain: (subdomain: string) => apiClient.get(`/tenants/subdomain/${subdomain}`),

  // Platform Admin calls
  listAll: () => apiClient.get('/tenants'),
  getMetrics: () => apiClient.get('/tenants/platform-metrics'),
  toggleStatus: (id: string, isActive: boolean) => apiClient.patch(`/tenants/${id}/status`, { isActive }),
};

