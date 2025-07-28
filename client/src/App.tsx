import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { startRegistration } from '@simplewebauthn/browser';

// Auth context and hooks
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { WebAuthnProvider } from '@/hooks/useWebAuthn';

// Layout components
import MainLayout from '@/components/layouts/MainLayout';
import AuthLayout from '@/components/layouts/AuthLayout';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import VerifyOtpPage from '@/pages/auth/VerifyOtpPage';
import BiometricSetupPage from '@/pages/auth/BiometricSetupPage';
import WalletHomePage from '@/pages/wallet/WalletHomePage';
import CredentialsPage from '@/pages/wallet/CredentialsPage';
import CredentialDetailPage from '@/pages/wallet/CredentialDetailPage';
import ProfilePage from '@/pages/wallet/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';

// Database initialization
import { initializeDatabase } from '@/utils/db';

// Initialize the database when the app starts
initializeDatabase();

/**
 * Protected Route component that redirects to login if not authenticated
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-200"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

/**
 * Public Route component that redirects to wallet if already authenticated
 */
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // If authenticated and not in a special flow (like OTP verification),
  // redirect to wallet home
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const from = (location.state as any)?.from?.pathname || '/wallet';
      
      // Don't redirect if we're in the OTP verification or biometric setup flow
      const inSpecialFlow = 
        location.pathname.includes('/verify-otp') || 
        location.pathname.includes('/biometric-setup');
      
      if (!inSpecialFlow) {
        navigate(from);
      }
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-200"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Main App component with routing
 */
const App = () => {
  // Theme state (light/dark mode)
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggle theme function
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <AuthProvider>
      <WebAuthnProvider>
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
          <Routes>
            {/* Public routes (login, register, etc.) */}
            <Route path="/" element={<AuthLayout />}>
              <Route index element={<Navigate to="/login" replace />} />
              
              <Route 
                path="login" 
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                } 
              />
              
              <Route 
                path="register" 
                element={
                  <PublicRoute>
                    <RegisterPage />
                  </PublicRoute>
                } 
              />
              
              <Route 
                path="verify-otp" 
                element={<VerifyOtpPage />} 
              />
              
              <Route 
                path="biometric-setup" 
                element={<BiometricSetupPage />} 
              />
            </Route>

            {/* Protected routes (wallet, credentials, etc.) */}
            <Route 
              path="/wallet" 
              element={
                <ProtectedRoute>
                  <MainLayout toggleTheme={toggleTheme} theme={theme} />
                </ProtectedRoute>
              }
            >
              <Route index element={<WalletHomePage />} />
              <Route path="credentials" element={<CredentialsPage />} />
              <Route path="credentials/:id" element={<CredentialDetailPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* 404 page */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          
          {/* Toast notifications */}
          <Toaster position="top-right" />
        </div>
      </WebAuthnProvider>
    </AuthProvider>
  );
};

export default App;
