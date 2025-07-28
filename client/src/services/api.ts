import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  RequestOtpRequest, 
  RequestOtpResponse, 
  VerifyOtpRequest, 
  VerifyOtpResponse,
  WebAuthnRegisterRequest,
  WebAuthnRegisterResponse,
  WebAuthnVerifyRegisterRequest,
  WebAuthnVerifyRegisterResponse,
  WebAuthnAuthenticateRequest,
  WebAuthnAuthenticateResponse,
  WebAuthnVerifyAuthenticateRequest,
  WebAuthnVerifyAuthenticateResponse,
  UserProfile,
  ApiError,
  WebAuthnCredential,
  DIDDocument,
  DIDMethod
} from '@/types';

// Storage keys
const TOKEN_STORAGE_KEY = 'auth_token';

/**
 * Base API configuration
 */
const API_CONFIG: AxiosRequestConfig = {
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000 // 30 seconds
};

/**
 * Create API instance with interceptors for auth and error handling
 */
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create(API_CONFIG);

  // Request interceptor to add auth token
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      // Handle token expiration
      if (error.response?.status === 401) {
        // Clear token if it's expired or invalid
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        
        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }

      // Format error response
      const apiError: ApiError = {
        error: error.name || 'Error',
        message: error.response?.data?.message || error.message || 'An unexpected error occurred',
        status: error.response?.status,
        details: error.response?.data?.details
      };

      return Promise.reject(apiError);
    }
  );

  return instance;
};

// Create API instance
const api = createApiInstance();

/**
 * Authentication API
 */
export const authApi = {
  /**
   * Request OTP for login or registration
   */
  requestOtp: async (data: RequestOtpRequest): Promise<RequestOtpResponse> => {
    const response = await api.post<RequestOtpResponse>('/auth/request-otp', data);
    return response.data;
  },

  /**
   * Verify OTP and get authentication token
   */
  verifyOtp: async (data: VerifyOtpRequest): Promise<VerifyOtpResponse> => {
    const response = await api.post<VerifyOtpResponse>('/auth/verify-otp', data);
    
    // Save token if provided
    if (response.data.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);
    }
    
    return response.data;
  },

  /**
   * Refresh authentication token
   */
  refreshToken: async (): Promise<{ token: string }> => {
    const response = await api.post<{ success: boolean; token: string; message: string }>('/auth/refresh-token');
    
    // Save new token
    if (response.data.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);
    }
    
    return { token: response.data.token };
  },

  /**
   * Validate authentication token
   */
  validateToken: async (token: string): Promise<{ valid: boolean; user?: UserProfile }> => {
    const response = await api.post<{ valid: boolean; user?: UserProfile }>('/auth/validate-token', { token });
    return response.data;
  },

  /**
   * Logout user (client-side)
   */
  logout: (): void => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    // Optionally call the server logout endpoint
    api.post('/auth/logout').catch(() => {
      // Ignore errors during logout
    });
  },

  /**
   * Get current authentication token
   */
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(TOKEN_STORAGE_KEY);
  }
};

/**
 * WebAuthn API
 */
export const webAuthnApi = {
  /**
   * Start WebAuthn registration process
   */
  register: async (data: WebAuthnRegisterRequest): Promise<WebAuthnRegisterResponse> => {
    const response = await api.post<WebAuthnRegisterResponse>('/webauthn/register', data);
    return response.data;
  },

  /**
   * Verify WebAuthn registration
   */
  verifyRegistration: async (data: WebAuthnVerifyRegisterRequest): Promise<WebAuthnVerifyRegisterResponse> => {
    const response = await api.post<WebAuthnVerifyRegisterResponse>('/webauthn/verify-registration', data);
    return response.data;
  },

  /**
   * Start WebAuthn authentication process
   */
  authenticate: async (data: WebAuthnAuthenticateRequest): Promise<WebAuthnAuthenticateResponse> => {
    const response = await api.post<WebAuthnAuthenticateResponse>('/webauthn/authenticate', data);
    return response.data;
  },

  /**
   * Verify WebAuthn authentication
   */
  verifyAuthentication: async (data: WebAuthnVerifyAuthenticateRequest): Promise<WebAuthnVerifyAuthenticateResponse> => {
    const response = await api.post<WebAuthnVerifyAuthenticateResponse>('/webauthn/verify-authentication', data);
    
    // Save token if provided
    if (response.data.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);
    }
    
    return response.data;
  },

  /**
   * Get registered WebAuthn credentials
   */
  getCredentials: async (): Promise<{ credentials: WebAuthnCredential[] }> => {
    const response = await api.get<{ success: boolean; credentials: WebAuthnCredential[] }>('/webauthn/credentials');
    return { credentials: response.data.credentials };
  },

  /**
   * Delete a WebAuthn credential
   */
  deleteCredential: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete<{ success: boolean; message: string }>(`/webauthn/credentials/${id}`);
    return response.data;
  }
};

/**
 * User API
 */
export const userApi = {
  /**
   * Get user profile
   */
  getProfile: async (): Promise<UserProfile> => {
    const response = await api.get<{ success: boolean; profile: UserProfile }>('/user/profile');
    return response.data.profile;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: Partial<UserProfile>): Promise<UserProfile> => {
    const response = await api.put<{ success: boolean; profile: UserProfile }>('/user/profile', data);
    return response.data.profile;
  },

  /**
   * Get user's DID information
   */
  getDid: async (): Promise<{ did: string; didDocument: DIDDocument }> => {
    const response = await api.get<{ success: boolean; did: string; didDocument: DIDDocument }>('/user/did');
    return { did: response.data.did, didDocument: response.data.didDocument };
  },

  /**
   * Generate a new DID for the user
   */
  generateDid: async (method: DIDMethod = DIDMethod.KEY, network?: string, keyType?: string): Promise<{
    did: string;
    didDocument: DIDDocument;
    publicKey: any;
  }> => {
    const response = await api.post<{
      success: boolean;
      did: string;
      didDocument: DIDDocument;
      publicKey: any;
    }>('/user/did/generate', { method, network, keyType });
    
    return {
      did: response.data.did,
      didDocument: response.data.didDocument,
      publicKey: response.data.publicKey
    };
  },

  /**
   * Validate a DID
   */
  validateDid: async (did: string): Promise<{ isValid: boolean; resolvable?: boolean; didDocument?: DIDDocument }> => {
    const response = await api.post<{
      success: boolean;
      isValid: boolean;
      resolvable?: boolean;
      didDocument?: DIDDocument;
    }>('/user/did/validate', { did });
    
    return {
      isValid: response.data.isValid,
      resolvable: response.data.resolvable,
      didDocument: response.data.didDocument
    };
  },

  /**
   * Delete user account
   */
  deleteAccount: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete<{ success: boolean; message: string }>('/user/account');
    
    // Clear token on successful account deletion
    if (response.data.success) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    
    return response.data;
  },

  /**
   * Check if email is available
   */
  checkEmailAvailability: async (email: string): Promise<{ available: boolean }> => {
    const response = await api.get<{ success: boolean; available: boolean }>(`/user/check-email/${encodeURIComponent(email)}`);
    return { available: response.data.available };
  },

  /**
   * Check if phone is available
   */
  checkPhoneAvailability: async (phone: string): Promise<{ available: boolean }> => {
    const response = await api.get<{ success: boolean; available: boolean }>(`/user/check-phone/${encodeURIComponent(phone)}`);
    return { available: response.data.available };
  }
};

// Export the API instance for custom requests
export default api;
