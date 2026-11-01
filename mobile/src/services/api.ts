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
  timeout: 10000,
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
export const getWeeklyMenuApi = (date?: string) =>
  api.get('/customer/menu/week', { params: { date } });
export const getUpcomingMenuApi = (weekStartDate?: string) =>
  api.get('/customer/menu/upcoming', { params: { weekStartDate } });
export const saveWeeklySelectionApi = (data: {
  weekStartDate: string;
  selections: any[];
  defaultDeliverySlotId?: string;
}) => api.post('/customer/selection/week', data);
export const getCustomerPlansApi = () => api.get('/customer/plans');
export const getCustomerDeliverySlotsApi = () => api.get('/customer/delivery-slots');
export const subscribeApi = (data: { planId: string; defaultDeliverySlotId?: string }) =>
  api.post('/customer/subscribe', data);
export const getMySubscriptionApi = () => api.get('/customer/subscription');
export const selectMealApi = (data: {
  date: string;
  mealTime: string;
  foodItemId: string;
  deliverySlotId: string;
}) => api.put('/customer/subscription/meal', data);
export const pauseSubscriptionApi = () => api.post('/customer/subscription/pause');
export const resumeSubscriptionApi = () => api.post('/customer/subscription/resume');
export const cancelSubscriptionApi = () => api.post('/customer/subscription/cancel');
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

export const getUpcomingWeeksApi = () => api.get('/admin/weeks');
export const getWeeklyMenuByWeekApi = (weekStartDate: string) =>
  api.get('/admin/weekly-menu/by-week', { params: { weekStartDate } });
export const saveWeeklyMenuDraftApi = (data: any) =>
  api.post('/admin/weekly-menu/save-draft', data);
export const publishWeeklyMenuApi = (data: { menuId?: string; weekStartDate?: string }) =>
  api.post('/admin/weekly-menu/publish', data);

export const getWeeklyMenusApi = () => api.get('/admin/weekly-menu');
export const createWeeklyMenuApi = (data: any) => api.post('/admin/weekly-menu', data);
export const updateWeeklyMenuApi = (id: string, data: any) =>
  api.put(`/admin/weekly-menu/${id}`, data);

export const getAdminPlansApi = () => api.get('/admin/plans');
export const createPlanApi = (data: any) => api.post('/admin/plans', data);
export const updatePlanApi = (id: string, data: any) => api.put(`/admin/plans/${id}`, data);
export const deletePlanApi = (id: string) => api.delete(`/admin/plans/${id}`);

export const getAllSubscriptionsApi = (status?: string) =>
  api.get('/admin/subscriptions', { params: { status } });
export const updateSubscriptionStatusApi = (id: string, status: string) =>
  api.put(`/admin/subscriptions/${id}/status`, { status });

export const getAdminOrdersApi = (params?: { date?: string; slotId?: string; status?: string }) =>
  api.get('/admin/orders', { params });
export const updateOrderStatusApi = (id: string, status: string) =>
  api.put(`/admin/orders/${id}/status`, { status });

export const getAdminDeliverySlotsApi = () => api.get('/admin/delivery-slots');
export const createDeliverySlotApi = (data: any) => api.post('/admin/delivery-slots', data);
export const updateDeliverySlotApi = (id: string, data: any) =>
  api.put(`/admin/delivery-slots/${id}`, data);
export const deleteDeliverySlotApi = (id: string) =>
  api.delete(`/admin/delivery-slots/${id}`);
