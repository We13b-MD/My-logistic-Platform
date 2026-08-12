import apiClient from '@/utils/axios';

export const driverApi = {
  createProfile: (data: { vehicleType: string; licenseNumber: string }) =>
    apiClient.post('/drivers/profile', data),
  getProfile: () => apiClient.get('/drivers/me'),
  updateProfile: (data: object) => apiClient.put('/drivers/profile', data),
  toggleOnlineStatus: (data: { isOnline: boolean; latitude?: number; longitude?: number }) =>
    apiClient.patch('/drivers/online', data),
  listForAdmin: (params?: object) => apiClient.get('/drivers', { params }),
  verifyDriver: (driverId: string, isVerified: boolean) =>
    apiClient.patch(`/drivers/${driverId}/verify`, { isVerified }),
};
