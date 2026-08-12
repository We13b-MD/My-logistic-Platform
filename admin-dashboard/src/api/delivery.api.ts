import apiClient from '@/utils/axios';

export const deliveryApi = {
  create: (data: object) => apiClient.post('/deliveries', data),
  list: (params?: object) => apiClient.get('/deliveries', { params }),
  getById: (id: string) => apiClient.get(`/deliveries/${id}`),
  updateStatus: (id: string, data: object) => apiClient.patch(`/deliveries/${id}/status`, data),
  uploadPOD: (data: { photoBase64?: string; signatureBase64?: string }) => apiClient.post('/deliveries/upload-pod', data),
  getDashboardMetrics: () => apiClient.get('/dashboard/metrics'),
};


