import apiClient from '@/utils/axios';

export const trackingApi = {
  getDeliveryDriverLocation: (deliveryId: string) =>
    apiClient.get(`/tracking/delivery/${deliveryId}`),
  getPublicTrackingInfo: (code: string) =>
    apiClient.get(`/tracking/public/${code}`),
  // Admin-only: fetch full GPS breadcrumb trail for a delivery (cargo audit)
  getBreadcrumbTrail: (deliveryId: string) =>
    apiClient.get(`/tracking/trail/${deliveryId}`),
};

