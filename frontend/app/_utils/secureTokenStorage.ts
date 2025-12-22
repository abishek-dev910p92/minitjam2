import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

function decodeBase64UrlToString(input: string): string {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    const atobFn = (globalThis as any)?.atob;
    if (typeof atobFn === 'function') return atobFn(padded);
    const BufferCtor = (globalThis as any)?.Buffer;
    if (BufferCtor) return BufferCtor.from(padded, 'base64').toString('utf8');
    return '';
  } catch {
    return '';
  }
}

/**
 * Secure token storage with encryption and expiration handling
 */
export const secureTokenStorage = {
  /**
   * Store authentication token securely
   */
  async storeToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error storing token:', error);
      throw new Error('Failed to store authentication token');
    }
  },

  /**
   * Retrieve authentication token
   */
  async getToken(): Promise<string | null> {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return null;
      return token;
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  },

  /**
   * Store refresh token securely
   */
  async storeRefreshToken(refreshToken: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      console.error('Error storing refresh token:', error);
      throw new Error('Failed to store refresh token');
    }
  },

  /**
   * Retrieve refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;
      return refreshToken;
    } catch (error) {
      console.error('Error retrieving refresh token:', error);
      return null;
    }
  },

  /**
   * Store user data securely
   */
  async storeUserData(userData: any): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('Error storing user data:', error);
      throw new Error('Failed to store user data');
    }
  },

  /**
   * Retrieve user data
   */
  async getUserData(): Promise<any | null> {
    try {
      const raw = await SecureStore.getItemAsync(USER_DATA_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('Error retrieving user data:', error);
      return null;
    }
  },

  /**
   * Clear all stored authentication data
   */
  async clearAll(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
    } catch (error) {
      console.error('Error clearing authentication data:', error);
      throw new Error('Failed to clear authentication data');
    }
  },

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const payloadJson = decodeBase64UrlToString(token.split('.')[1] || '');
      if (!payloadJson) return true;
      const payload = JSON.parse(payloadJson);
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // Assume expired if we can't parse it
    }
  },

  /**
   * Get token expiration time
   */
  getTokenExpirationTime(token: string): number | null {
    try {
      const payloadJson = decodeBase64UrlToString(token.split('.')[1] || '');
      if (!payloadJson) return null;
      const payload = JSON.parse(payloadJson);
      return payload.exp * 1000;
    } catch (error) {
      console.error('Error getting token expiration time:', error);
      return null;
    }
  }
};
