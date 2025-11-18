import { deleteItemAsync, getItem, setItem } from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Define the state and actions for the store
type UserState = {
  isLoggedIn: boolean;
  shouldCreateAccount: boolean;
  hasCreatedAccount: boolean; 
  login: () => void;
  logOut: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
};

// Custom storage object for Zustand's persist middleware, using expo-secure-store
// This object must return a key-value store with getItem, setItem, and removeItem methods.
const secureStoreStorage = {
  getItem: (name: string) => {
    return getItem(name);
  },
  setItem: (name: string, value: string) => {
    setItem(name, value);
  },
  removeItem: (name: string) => {
    deleteItemAsync(name);
  },
};

const useAuthStore = create(
  persist<UserState>(
    (set) => ({
      // Initial state
      isLoggedIn: false,
      shouldCreateAccount: false,
      hasCreatedAccount: false,
      // Actions to update the state
      login: () =>
        set({
          isLoggedIn: true,
        }),
      logOut: () =>
        set({
          isLoggedIn: false,
        }),
      completeOnboarding: () => set({ hasCreatedAccount: true }),
      createAccount: () => {
    set({ hasCreatedAccount: true, shouldCreateAccount: false });
  },
      resetOnboarding: () => set({ shouldCreateAccount: false, hasCreatedAccount: false }),

        reset: () =>
        set({
          isLoggedIn: false,
          shouldCreateAccount: false,
          hasCreatedAccount: false,
        }),
    }),
    {
      name: 'auth-storage',
      // Pass the custom storage object to createJSONStorage
      storage: createJSONStorage(() => secureStoreStorage),
    }
  )
);

export default useAuthStore;