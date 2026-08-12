import apiClient from '@/utils/axios';

export const authApi = {
  // Login — works for all roles
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),

  // Register a Driver or Customer under an existing tenant
  register: (data: {
    email: string;
    password: string;
    role: 'CUSTOMER' | 'DRIVER';
    tenantId: string;
  }) => apiClient.post('/auth/register', data),

  // Google OAuth 2.0 Login
  googleLogin: (payload: {
    email: string;
    googleId?: string;
    name?: string;
    avatarUrl?: string;
    requestedRole?: string;
  }) => apiClient.post('/auth/google', payload),
};

