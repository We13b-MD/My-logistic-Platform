import axios from 'axios';
import { storage } from '@/utils/storage';

// Axios instance pointing to backend API (dynamic production URL vs local dev proxy)
const rawApiUrl = import.meta.env.VITE_API_URL || '';
const baseURL = rawApiUrl ? `${rawApiUrl.replace(/\/$/, '')}/api/v1` : '/api/v1';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — automatically attaches JWT token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handles 401 globally (token expired/invalid)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized, redirect to login, EXCEPT when we are actually trying to log in
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      storage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
