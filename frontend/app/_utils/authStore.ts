import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { secureTokenStorage } from './secureTokenStorage';
import { tokenRefreshManager } from './tokenRefreshManager';

type UserRole = 'artist' | 'club' | null;

type UserState = {
  isLoggedIn: boolean;
  shouldCreateAccount: boolean;
  hasCreatedAccount: boolean;
  userRole: UserRole;
  userData: any | null;
  token: string | null;
  refreshTokenValue: string | null;
  login: (token: string, refreshToken: string, userData: any, role: Exclude<UserRole, null>) => Promise<void>;
  logOut: () => Promise<void>;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  createAccount: () => void;
  reset: () => void;
  hydrate: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  getValidToken: () => Promise<string | null>;
};

const secureStoreStorage = {
  getItem: async (name: string) => {
    const value = await SecureStore.getItemAsync(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

const useAuthStore = create<UserState>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      shouldCreateAccount: false,
      hasCreatedAccount: false,
      userRole: null,
      userData: null,
      token: null,
      refreshTokenValue: null,

      login: async (token, refreshToken, userData, role) => {
        await secureTokenStorage.storeToken(token);
        await secureTokenStorage.storeRefreshToken(refreshToken);
        await secureTokenStorage.storeUserData(userData);
        set({
          isLoggedIn: true,
          token,
          refreshTokenValue: refreshToken,
          userData,
          userRole: role,
        });
      },

      logOut: async () => {
        await secureTokenStorage.clearAll();
        set({
          isLoggedIn: false,
          token: null,
          refreshTokenValue: null,
          userData: null,
          userRole: null,
        });
      },

      completeOnboarding: () => set({ hasCreatedAccount: true, shouldCreateAccount: false }),
      createAccount: () => set({ hasCreatedAccount: true, shouldCreateAccount: false }),
      resetOnboarding: () => set({ shouldCreateAccount: false, hasCreatedAccount: false }),

      reset: () =>
        set({
          isLoggedIn: false,
          shouldCreateAccount: false,
          hasCreatedAccount: false,
          userRole: null,
          userData: null,
          token: null,
          refreshTokenValue: null,
        }),

      hydrate: async () => {
        const token = await secureTokenStorage.getToken();
        const refreshTokenValue = await secureTokenStorage.getRefreshToken();
        const userData = await secureTokenStorage.getUserData();
        set({
          token,
          refreshTokenValue,
          userData,
          isLoggedIn: !!token,
        });
      },

      refreshToken: async () => {
        const newToken = await tokenRefreshManager.refreshToken();
        if (!newToken) {
          await get().logOut();
          return null;
        }
        set({ token: newToken, isLoggedIn: true });
        return newToken;
      },

      getValidToken: async () => {
        const token = await tokenRefreshManager.checkAndRefreshToken();
        if (!token) return null;
        set({ token, isLoggedIn: true });
        return token;
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStoreStorage),
      onRehydrateStorage: () => (state, err) => {
        if (!err) state?.hydrate?.();
      },
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        shouldCreateAccount: state.shouldCreateAccount,
        hasCreatedAccount: state.hasCreatedAccount,
        userRole: state.userRole,
      }),
    }
  )
);

export default useAuthStore;
