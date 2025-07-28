import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { OtpDeliveryMethod } from '@/types';

// Icons
import { EnvelopeIcon, DevicePhoneMobileIcon, FingerPrintIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

/**
 * LoginPage Component
 * 
 * Provides user authentication with:
 * - Email or phone input
 * - WebAuthn biometric authentication
 * - OTP verification flow
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { isSupported: isWebAuthnSupported, authenticateWithWebAuthn, error: webAuthnError, clearError } = useWebAuthn();
  
  // Form state
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'email' | 'phone'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWebAuthn, setShowWebAuthn] = useState(false);

  // Check if the device supports WebAuthn on mount
  useEffect(() => {
    if (isWebAuthnSupported) {
      setShowWebAuthn(true);
    }
  }, [isWebAuthnSupported]);

  // Clear WebAuthn errors when unmounting
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Detect identifier type as user types
  useEffect(() => {
    if (identifier.startsWith('+') || /^\d+$/.test(identifier)) {
      setIdentifierType('phone');
    } else if (identifier.includes('@')) {
      setIdentifierType('email');
    }
  }, [identifier]);

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Validate phone format (basic E.164 validation)
  const isValidPhone = (phone: string): boolean => {
    return /^\+[1-9]\d{1,14}$/.test(phone);
  };

  // Validate input based on type
  const validateInput = (): boolean => {
    if (!identifier.trim()) {
      setError('Please enter your email or phone number');
      return false;
    }

    if (identifierType === 'email' && !isValidEmail(identifier)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (identifierType === 'phone' && !isValidPhone(identifier)) {
      setError('Please enter a valid phone number in international format (e.g., +12125551234)');
      return false;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateInput()) {
      return;
    }

    setIsLoading(true);

    try {
      // Request OTP
      const { otpId, method } = await login(
        identifierType === 'email' ? identifier : undefined,
        identifierType === 'phone' ? identifier : undefined
      );

      // Navigate to OTP verification page
      navigate('/verify-otp', {
        state: {
          otpId,
          method,
          identifier,
          identifierType,
          purpose: 'login'
        }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to request verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle WebAuthn authentication
  const handleWebAuthnLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const success = await authenticateWithWebAuthn(
        identifierType === 'email' ? identifier : undefined,
        identifierType === 'phone' ? identifier : undefined
      );

      if (success) {
        navigate('/wallet');
      } else if (webAuthnError) {
        setError(webAuthnError);
      }
    } catch (err: any) {
      setError(err.message || 'Biometric authentication failed. Please try using OTP instead.');
    } finally {
      setIsLoading(false);
    }
  };

  // Format phone number for better readability
  const formatPhoneHint = () => {
    if (identifier.startsWith('+')) {
      return 'International format: +[country code][number]';
    }
    return 'Add country code (e.g., +1 for US)';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Sign In</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Access your secure identity wallet
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email/Phone Input */}
        <div>
          <label htmlFor="identifier" className="form-label">
            Email or Phone Number
          </label>
          <div className="relative mt-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {identifierType === 'email' ? (
                <EnvelopeIcon className="h-5 w-5 text-neutral-400" aria-hidden="true" />
              ) : (
                <DevicePhoneMobileIcon className="h-5 w-5 text-neutral-400" aria-hidden="true" />
              )}
            </div>
            <input
              id="identifier"
              name="identifier"
              type={identifierType === 'email' ? 'email' : 'tel'}
              autoComplete={identifierType === 'email' ? 'email' : 'tel'}
              required
              className="form-input pl-10"
              placeholder={identifierType === 'email' ? 'you@example.com' : '+12125551234'}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setError(null);
              }}
              aria-invalid={!!error}
              aria-describedby={error ? 'identifier-error' : undefined}
              disabled={isLoading}
            />
          </div>
          {identifierType === 'phone' && identifier && (
            <p className="form-hint">{formatPhoneHint()}</p>
          )}
          {error && (
            <p className="form-error" id="identifier-error" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending code...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              Continue with OTP
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </span>
          )}
        </button>

        {/* WebAuthn Option */}
        {showWebAuthn && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-300 dark:border-neutral-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                Or continue with
              </span>
            </div>
          </div>
        )}

        {showWebAuthn && (
          <button
            type="button"
            className="btn-outline w-full flex items-center justify-center"
            onClick={handleWebAuthnLogin}
            disabled={isLoading || !identifier}
          >
            <FingerPrintIcon className="h-5 w-5 mr-2" />
            Biometric Login
          </button>
        )}

        {webAuthnError && (
          <p className="form-error text-center" role="alert">
            {webAuthnError}
          </p>
        )}
      </form>

      {/* Registration Link */}
      <div className="text-center mt-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-hedera-600 hover:text-hedera-500 dark:text-hedera-400 dark:hover:text-hedera-300"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
