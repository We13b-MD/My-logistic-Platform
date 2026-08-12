import apiClient from '@/utils/axios';
import { CreateVehicleInput, UpdateVehicleInput, VehicleStatus, VehicleType } from '@/types';

export const vehicleApi = {
  create: (data: CreateVehicleInput) => apiClient.post('/vehicles', data),
  list: (params?: { status?: VehicleStatus; vehicleType?: VehicleType; search?: string }) =>
    apiClient.get('/vehicles', { params }),
  getById: (id: string) => apiClient.get(`/vehicles/${id}`),
  update: (id: string, data: UpdateVehicleInput) => apiClient.put(`/vehicles/${id}`, data),
  assignDriver: (id: string, driverId: string | null) =>
    apiClient.patch(`/vehicles/${id}/assign-driver`, { driverId }),
  delete: (id: string) => apiClient.delete(`/vehicles/${id}`),
};
