import { secureTokenStorage } from './secureTokenStorage';
import apiEndpoints from '../api/baseUrl';

/**
 * Token refresh manager to handle automatic token refresh
 */
export class TokenRefreshManager {
  private isRefreshing: boolean = false;
  private failedQueue: Array<{resolve: (value?: any) => void, reject: (reason?: any) => void}> = [];

  /**
   * Refresh the authentication token using the refresh token
   */
  async refreshToken(): Promise<string | null> {
    if (this.isRefreshing) {
      // If already refreshing, queue the request
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;
    const refreshToken = await secureTokenStorage.getRefreshToken();

    if (!refreshToken) {
      this.isRefreshing = false;
      this.processQueue(false, 'No refresh token available');
      return null;
    }

    try {
      const response = await fetch(`${apiEndpoints.baseURL}auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      // Store the new tokens
      await secureTokenStorage.storeToken(data.token);
      if (data.refreshToken) {
        await secureTokenStorage.storeRefreshToken(data.refreshToken);
      }

      this.isRefreshing = false;
      this.processQueue(true, data.token);
      
      return data.token;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.isRefreshing = false;
      this.processQueue(false, error);
      
      // Clear all tokens on refresh failure
      await secureTokenStorage.clearAll();
      
      return null;
    }
  }

  /**
   * Process any queued requests after refresh completes
   */
  private processQueue(success: boolean, data: any): void {
    this.failedQueue.forEach(promise => {
      if (success) {
        promise.resolve(data);
      } else {
        promise.reject(data);
      }
    });
    
    this.failedQueue = [];
  }

  /**
   * Check if token needs refresh and refresh if necessary
   */
  async checkAndRefreshToken(): Promise<string | null> {
    const token = await secureTokenStorage.getToken();
    
    if (!token) {
      return null;
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const expirationTime = secureTokenStorage.getTokenExpirationTime(token);
    if (!expirationTime) {
      return token;
    }

    const currentTime = Date.now();
    const timeUntilExpiry = expirationTime - currentTime;
    const fiveMinutes = 5 * 60 * 1000;

    if (timeUntilExpiry <= fiveMinutes) {
      // Token is expired or about to expire, refresh it
      return await this.refreshToken();
    }

    return token;
  }
}

// Export singleton instance
export const tokenRefreshManager = new TokenRefreshManager();