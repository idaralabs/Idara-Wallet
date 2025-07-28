import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, userApi } from '@/services/api';
import { AuthState, UserProfile, OtpDeliveryMethod } from '@/types';
import jwt_decode from 'jwt-decode';

// Define the shape of the auth context
interface AuthContextType extends AuthState {
  login: (email?: string, phone?: string) => Promise<{ otpId: string; method: OtpDeliveryMethod }>;
  verifyOtp: (otpId: string, code: string, registerUser?: boolean, name?: string) => Promise<{
    success: boolean;
    isNewUser?: boolean;
    supportsWebAuthn?: boolean;
  }>;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
  updateUser: (userData: Partial<UserProfile>) => Promise<UserProfile>;
  isTokenExpired: () => boolean;
  getToken: () => string | null;
}

// Create the auth context with a default value
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
  login: async () => ({ otpId: '', method: OtpDeliveryMethod.EMAIL }),
  verifyOtp: async () => ({ success: false }),
  logout: () => {},
  refreshToken: async () => null,
  updateUser: async () => ({ id: '', name: '' }),
  isTokenExpired: () => true,
  getToken: () => null,
});

// Storage keys
const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'user_profile';

/**
 * Auth Provider component that wraps the application and provides auth context
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,
  });

  // Check if token is expired
  const isTokenExpired = useCallback(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return true;

    try {
      const decoded: any = jwt_decode(token);
      const currentTime = Date.now() / 1000;
      
      // Check if token is expired or about to expire in the next 5 minutes
      return decoded.exp < currentTime || decoded.exp < currentTime + 300;
    } catch (error) {
      console.error('Error decoding token:', error);
      return true;
    }
  }, []);

  // Get current token
  const getToken = useCallback((): string | null => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }, []);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const userJson = localStorage.getItem(USER_STORAGE_KEY);
        
        if (token && !isTokenExpired()) {
          // Token exists and is not expired
          let user: UserProfile | null = null;
          
          // Try to parse stored user profile
          if (userJson) {
            try {
              user = JSON.parse(userJson);
            } catch (e) {
              console.error('Error parsing stored user profile:', e);
            }
          }
          
          // If no stored user or parsing failed, fetch from API
          if (!user) {
            try {
              user = await userApi.getProfile();
              localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            } catch (error) {
              console.error('Error fetching user profile:', error);
              // Token might be invalid, clear auth state
              localStorage.removeItem(TOKEN_STORAGE_KEY);
              localStorage.removeItem(USER_STORAGE_KEY);
              setState({
                isAuthenticated: false,
                isLoading: false,
                user: null,
                token: null,
              });
              return;
            }
          }
          
          setState({
            isAuthenticated: true,
            isLoading: false,
            user,
            token,
          });
        } else if (token && isTokenExpired()) {
          // Token exists but is expired, try to refresh
          try {
            const { token: newToken } = await authApi.refreshToken();
            
            // Fetch user profile with new token
            const user = await userApi.getProfile();
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            
            setState({
              isAuthenticated: true,
              isLoading: false,
              user,
              token: newToken,
            });
          } catch (error) {
            console.error('Error refreshing token:', error);
            // Clear auth state
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(USER_STORAGE_KEY);
            setState({
              isAuthenticated: false,
              isLoading: false,
              user: null,
              token: null,
            });
          }
        } else {
          // No token, not authenticated
          setState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            token: null,
          });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          token: null,
        });
      }
    };

    initializeAuth();
  }, [isTokenExpired]);

  // Refresh token function
  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const { token } = await authApi.refreshToken();
      
      setState(prevState => ({
        ...prevState,
        token,
      }));
      
      return token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }, []);

  // Login function - requests OTP
  const login = useCallback(async (email?: string, phone?: string) => {
    if (!email && !phone) {
      throw new Error('Email or phone is required');
    }

    const response = await authApi.requestOtp({
      email,
      phone,
      purpose: 'login',
    });

    return {
      otpId: response.otpId,
      method: response.method,
    };
  }, []);

  // Verify OTP function
  const verifyOtp = useCallback(async (otpId: string, code: string, registerUser?: boolean, name?: string) => {
    try {
      const response = await authApi.verifyOtp({
        otpId,
        code,
        registerUser,
        name,
      });

      if (response.success && response.token && response.user) {
        // Save token and user to localStorage
        localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));

        // Update auth state
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: response.user,
          token: response.token,
        });

        return {
          success: true,
          isNewUser: response.isNewUser,
          supportsWebAuthn: response.supportsWebAuthn,
        };
      }

      return { success: false };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false };
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    // Clear auth state
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      token: null,
    });
    
    // Call server logout endpoint (optional)
    authApi.logout();
    
    // Redirect to login page
    navigate('/login');
  }, [navigate]);

  // Update user function
  const updateUser = useCallback(async (userData: Partial<UserProfile>): Promise<UserProfile> => {
    try {
      const updatedUser = await userApi.updateProfile(userData);
      
      // Update localStorage and state
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      
      setState(prevState => ({
        ...prevState,
        user: updatedUser,
      }));
      
      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, []);

  // Provide auth context value
  const contextValue: AuthContextType = {
    ...state,
    login,
    verifyOtp,
    logout,
    refreshToken,
    updateUser,
    isTokenExpired,
    getToken,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use the auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default useAuth;
