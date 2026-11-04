import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:5000/api) to run on a real device.
// Fallbacks: iOS simulator reaches the host on localhost, Android emulator on 10.0.2.2.
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api');

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Generous: a free-tier server can take ~50s to wake from sleep on the first request
  timeout: 60000,
});

// Request interceptor: attach token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('@access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Error reading token from AsyncStorage', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('@refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const res = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = res.data.accessToken;
        await AsyncStorage.setItem('@access_token', newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        await AsyncStorage.multiRemove(['@access_token', '@refresh_token', '@user_data']);
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

// -------------------------------------------------------------
// AUTH APIS
// -------------------------------------------------------------
export const registerApi = (data: any) => api.post('/auth/register', data);
export const adminRegisterApi = (data: any) => api.post('/auth/admin/register', data);
export const loginApi = (data: any) => api.post('/auth/login', data);
export const getMeApi = () => api.get('/auth/me');
export const updateMeApi = (data: any) => api.put('/auth/me', data);

// -------------------------------------------------------------
// CUSTOMER APIS
// -------------------------------------------------------------
export const getWeekPlanApi = (weekStartDate?: string) =>
  api.get('/customer/week', { params: { weekStartDate } });
export const saveWeeklySelectionApi = (data: {
  weekStartDate: string;
  days: { dayName: string; items: { foodItem: string; quantity: number }[]; pickupSlot: string | null }[];
}) => api.post('/customer/selection/week', data);
export const getMyBillsApi = () => api.get('/customer/bills');
export const getMyOrdersApi = (date?: string) =>
  api.get('/customer/orders', { params: { date } });

// -------------------------------------------------------------
// ADMIN APIS
// -------------------------------------------------------------
export const getDashboardStatsApi = () => api.get('/admin/dashboard');
export const getFoodItemsApi = (params?: any) => api.get('/admin/food-items', { params });
export const createFoodItemApi = (data: any) => api.post('/admin/food-items', data);
export const updateFoodItemApi = (id: string, data: any) =>
  api.put(`/admin/food-items/${id}`, data);
export const deleteFoodItemApi = (id: string) => api.delete(`/admin/food-items/${id}`);

export const getAdminMenuApi = (weekStartDate?: string) =>
  api.get('/admin/menu', { params: { weekStartDate } });
export const saveAdminMenuApi = (data: { weekStartDate: string; days: { dayName: string; dishes: string[] }[] }) =>
  api.put('/admin/menu', data);

export const getBillsApi = (weekStartDate?: string) => api.get('/admin/bills', { params: { weekStartDate } });
export const setBillPaymentApi = (
  id: string,
  data: { paid: boolean; method?: 'cash' | 'bank_transfer' | 'payid' | 'other'; reference?: string }
) => api.put(`/admin/bills/${id}/payment`, data);

export const getAdminOrdersApi = (params?: { date?: string; pickupSlotId?: string; status?: string }) =>
  api.get('/admin/orders', { params });
export const updateOrderStatusApi = (id: string, status: string) =>
  api.put(`/admin/orders/${id}/status`, { status });

export const getPickupSlotsApi = () => api.get('/admin/pickup-slots');
export const createPickupSlotApi = (data: any) => api.post('/admin/pickup-slots', data);
export const updatePickupSlotApi = (id: string, data: any) =>
  api.put(`/admin/pickup-slots/${id}`, data);
export const deletePickupSlotApi = (id: string) => api.delete(`/admin/pickup-slots/${id}`);
