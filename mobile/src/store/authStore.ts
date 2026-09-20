import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { loginApi, registerApi, adminRegisterApi, getMeApi } from '../services/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerCustomer: (data: any) => Promise<{ success: boolean; error?: string }>;
  registerAdmin: (data: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isInitializing: true,
  error: null,

  loadStoredAuth: async () => {
    try {
      set({ isInitializing: true });
      const [token, refreshToken, userData] = await Promise.all([
        AsyncStorage.getItem('@access_token'),
        AsyncStorage.getItem('@refresh_token'),
        AsyncStorage.getItem('@user_data'),
      ]);

      if (token && userData) {
        set({
          accessToken: token,
          refreshToken,
          user: JSON.parse(userData),
        });

        // Silently verify user
        try {
          const res = await getMeApi();
          if (res.data?.user) {
            set({ user: res.data.user });
            await AsyncStorage.setItem('@user_data', JSON.stringify(res.data.user));
          }
        } catch (e) {
          // Token might still be good or refresh handler will trigger
        }
      }
    } catch (e) {
      console.error('Failed to load stored auth credentials:', e);
    } finally {
      set({ isInitializing: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await loginApi({ email, password });
      const { accessToken, refreshToken, user } = response.data;

      await AsyncStorage.multiSet([
        ['@access_token', accessToken],
        ['@refresh_token', refreshToken],
        ['@user_data', JSON.stringify(user)],
      ]);

      set({
        accessToken,
        refreshToken,
        user,
        isLoading: false,
      });

      return { success: true };
    } catch (err: any) {
      const msg =
        err.response?.data?.message || 'Login failed. Please check your credentials.';
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  registerCustomer: async (data: any) => {
    set({ isLoading: true, error: null });
    try {
      const response = await registerApi(data);
      const { accessToken, refreshToken, user } = response.data;

      await AsyncStorage.multiSet([
        ['@access_token', accessToken],
        ['@refresh_token', refreshToken],
        ['@user_data', JSON.stringify(user)],
      ]);

      set({
        accessToken,
        refreshToken,
        user,
        isLoading: false,
      });

      return { success: true };
    } catch (err: any) {
      const msg =
        err.response?.data?.message || 'Registration failed. Please check your input.';
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  registerAdmin: async (data: any) => {
    set({ isLoading: true, error: null });
    try {
      const response = await adminRegisterApi(data);
      const { accessToken, refreshToken, user } = response.data;

      await AsyncStorage.multiSet([
        ['@access_token', accessToken],
        ['@refresh_token', refreshToken],
        ['@user_data', JSON.stringify(user)],
      ]);

      set({
        accessToken,
        refreshToken,
        user,
        isLoading: false,
      });

      return { success: true };
    } catch (err: any) {
      const msg =
        err.response?.data?.message || 'Admin registration failed.';
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.multiRemove([
        '@access_token',
        '@refresh_token',
        '@user_data',
      ]);
    } catch (e) {
      console.error('Failed to remove tokens from storage:', e);
    }
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    });
  },

  setUser: (user: User) => {
    set({ user });
    AsyncStorage.setItem('@user_data', JSON.stringify(user));
  },

  clearError: () => set({ error: null }),
}));
