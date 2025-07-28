import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { webAuthnApi } from '@/services/api';
import { WebAuthnCredential } from '@/types';
import { useAuth } from './useAuth';

// Define the shape of the WebAuthn context
interface WebAuthnContextType {
  // State
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
  credentials: WebAuthnCredential[];
  
  // Methods
  registerWebAuthn: (userId: string, name?: string) => Promise<boolean>;
  authenticateWithWebAuthn: (email?: string, phone?: string) => Promise<boolean>;
  getCredentials: () => Promise<WebAuthnCredential[]>;
  deleteCredential: (id: string) => Promise<boolean>;
  clearError: () => void;
}

// Create the WebAuthn context with a default value
const WebAuthnContext = createContext<WebAuthnContextType>({
  isSupported: false,
  isLoading: false,
  error: null,
  credentials: [],
  registerWebAuthn: async () => false,
  authenticateWithWebAuthn: async () => false,
  getCredentials: async () => [],
  deleteCredential: async () => false,
  clearError: () => {},
});

/**
 * Check if WebAuthn is supported in the current browser
 */
const checkWebAuthnSupport = (): boolean => {
  return (
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof window.navigator.credentials !== 'undefined' &&
    typeof window.navigator.credentials.create === 'function' &&
    typeof window.navigator.credentials.get === 'function'
  );
};

/**
 * WebAuthn Provider component that wraps the application and provides WebAuthn context
 */
export const WebAuthnProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);

  // Check WebAuthn support when component mounts
  useEffect(() => {
    const supported = checkWebAuthnSupport();
    setIsSupported(supported);
    
    // Log support status for debugging
    if (supported) {
      console.log('WebAuthn is supported in this browser');
    } else {
      console.log('WebAuthn is not supported in this browser');
    }
  }, []);

  // Fetch user's WebAuthn credentials when authenticated
  useEffect(() => {
    if (isAuthenticated && user && isSupported) {
      fetchCredentials();
    }
  }, [isAuthenticated, user, isSupported]);

  // Fetch user's WebAuthn credentials
  const fetchCredentials = useCallback(async () => {
    if (!isSupported || !isAuthenticated) return;
    
    try {
      setIsLoading(true);
      const { credentials } = await webAuthnApi.getCredentials();
      setCredentials(credentials);
    } catch (error: any) {
      console.error('Error fetching WebAuthn credentials:', error);
      setError(error.message || 'Failed to fetch WebAuthn credentials');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isAuthenticated]);

  // Register a new WebAuthn credential
  const registerWebAuthn = useCallback(async (userId: string, name?: string): Promise<boolean> => {
    if (!isSupported) {
      setError('WebAuthn is not supported in this browser');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 1. Get registration options from server
      const { sessionId, options } = await webAuthnApi.register({ userId, name });

      // 2. Start the registration process in the browser
      const attResp = await startRegistration(options);

      // 3. Send the response to the server for verification
      const verificationResp = await webAuthnApi.verifyRegistration({
        sessionId,
        credential: attResp,
      });

      if (verificationResp.success) {
        // 4. Refresh credentials list
        await fetchCredentials();
        return true;
      } else {
        setError(verificationResp.message || 'Registration failed');
        return false;
      }
    } catch (error: any) {
      console.error('WebAuthn registration error:', error);
      
      // Handle user abort separately
      if (error.name === 'NotAllowedError') {
        setError('Registration was cancelled by the user');
      } else {
        setError(error.message || 'Failed to register WebAuthn credential');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, fetchCredentials]);

  // Authenticate with WebAuthn
  const authenticateWithWebAuthn = useCallback(async (email?: string, phone?: string): Promise<boolean> => {
    if (!isSupported) {
      setError('WebAuthn is not supported in this browser');
      return false;
    }

    if (!email && !phone) {
      setError('Email or phone is required for WebAuthn authentication');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 1. Get authentication options from server
      const { sessionId, options } = await webAuthnApi.authenticate({ email, phone });

      // 2. Start the authentication process in the browser
      const authResp = await startAuthentication(options);

      // 3. Send the response to the server for verification
      const verificationResp = await webAuthnApi.verifyAuthentication({
        sessionId,
        credential: authResp,
      });

      if (verificationResp.success) {
        return true;
      } else {
        setError(verificationResp.message || 'Authentication failed');
        return false;
      }
    } catch (error: any) {
      console.error('WebAuthn authentication error:', error);
      
      // Handle user abort separately
      if (error.name === 'NotAllowedError') {
        setError('Authentication was cancelled by the user');
      } else {
        setError(error.message || 'Failed to authenticate with WebAuthn');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Get user's WebAuthn credentials
  const getCredentials = useCallback(async (): Promise<WebAuthnCredential[]> => {
    if (!isSupported || !isAuthenticated) {
      return [];
    }

    try {
      setIsLoading(true);
      const { credentials } = await webAuthnApi.getCredentials();
      setCredentials(credentials);
      return credentials;
    } catch (error: any) {
      console.error('Error fetching WebAuthn credentials:', error);
      setError(error.message || 'Failed to fetch WebAuthn credentials');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isAuthenticated]);

  // Delete a WebAuthn credential
  const deleteCredential = useCallback(async (id: string): Promise<boolean> => {
    if (!isSupported || !isAuthenticated) {
      return false;
    }

    try {
      setIsLoading(true);
      const response = await webAuthnApi.deleteCredential(id);
      
      if (response.success) {
        // Update credentials list
        setCredentials(prev => prev.filter(cred => cred.id !== id));
        return true;
      } else {
        setError(response.message || 'Failed to delete credential');
        return false;
      }
    } catch (error: any) {
      console.error('Error deleting WebAuthn credential:', error);
      setError(error.message || 'Failed to delete WebAuthn credential');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isAuthenticated]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Provide WebAuthn context value
  const contextValue: WebAuthnContextType = {
    isSupported,
    isLoading,
    error,
    credentials,
    registerWebAuthn,
    authenticateWithWebAuthn,
    getCredentials,
    deleteCredential,
    clearError,
  };

  return <WebAuthnContext.Provider value={contextValue}>{children}</WebAuthnContext.Provider>;
};

/**
 * Custom hook to use the WebAuthn context
 */
export const useWebAuthn = () => {
  const context = useContext(WebAuthnContext);
  
  if (context === undefined) {
    throw new Error('useWebAuthn must be used within a WebAuthnProvider');
  }
  
  return context;
};

export default useWebAuthn;
