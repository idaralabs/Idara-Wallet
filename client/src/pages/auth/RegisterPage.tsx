import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { OtpDeliveryMethod } from '@/types';

// Icons
import { EnvelopeIcon, DevicePhoneMobileIcon, UserIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

/**
 * RegisterPage Component
 * 
 * Provides user registration with:
 * - Name input
 * - Email or phone input
 * - OTP verification flow
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Form state
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'email' | 'phone'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    identifier?: string;
  }>({});

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
    const errors: { name?: string; identifier?: string } = {};
    let isValid = true;

    // Validate name
    if (!name.trim()) {
      errors.name = 'Please enter your name';
      isValid = false;
    } else if (name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
      isValid = false;
    }

    // Validate identifier
    if (!identifier.trim()) {
      errors.identifier = 'Please enter your email or phone number';
      isValid = false;
    } else if (identifierType === 'email' && !isValidEmail(identifier)) {
      errors.identifier = 'Please enter a valid email address';
      isValid = false;
    } else if (identifierType === 'phone' && !isValidPhone(identifier)) {
      errors.identifier = 'Please enter a valid phone number in international format (e.g., +12125551234)';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!validateInput()) {
      return;
    }

    setIsLoading(true);

    try {
      // Request OTP for registration
      const { otpId, method } = await login(
        identifierType === 'email' ? identifier : undefined,
        identifierType === 'phone' ? identifier : undefined
      );

      // Navigate to OTP verification page with registration data
      navigate('/verify-otp', {
        state: {
          otpId,
          method,
          identifier,
          identifierType,
          name,
          purpose: 'registration'
        }
      });
    } catch (err: any) {
      // Handle specific error cases
      if (err.message?.includes('already exists')) {
        setError('An account with this ' + identifierType + ' already exists. Please sign in instead.');
      } else {
        setError(err.message || 'Failed to request verification code. Please try again.');
      }
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
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Create Account</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Get started with your secure identity wallet
        </p>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Input */}
        <div>
          <label htmlFor="name" className="form-label">
            Full Name
          </label>
          <div className="relative mt-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <UserIcon className="h-5 w-5 text-neutral-400" aria-hidden="true" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className="form-input pl-10"
              placeholder="John Doe"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors({ ...fieldErrors, name: undefined });
              }}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              disabled={isLoading}
            />
          </div>
          {fieldErrors.name && (
            <p className="form-error" id="name-error" role="alert">
              {fieldErrors.name}
            </p>
          )}
        </div>

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
                setFieldErrors({ ...fieldErrors, identifier: undefined });
              }}
              aria-invalid={!!fieldErrors.identifier}
              aria-describedby={fieldErrors.identifier ? 'identifier-error' : undefined}
              disabled={isLoading}
            />
          </div>
          {identifierType === 'phone' && identifier && (
            <p className="form-hint">{formatPhoneHint()}</p>
          )}
          {fieldErrors.identifier && (
            <p className="form-error" id="identifier-error" role="alert">
              {fieldErrors.identifier}
            </p>
          )}
        </div>

        {/* General Error Message */}
        {error && (
          <div className="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded-lg" role="alert">
            <p>{error}</p>
          </div>
        )}

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
              Create Account
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </span>
          )}
        </button>

        {/* Terms and Privacy */}
        <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
          By creating an account, you agree to our{' '}
          <a href="#" className="text-hedera-600 hover:text-hedera-500 dark:text-hedera-400 dark:hover:text-hedera-300">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-hedera-600 hover:text-hedera-500 dark:text-hedera-400 dark:hover:text-hedera-300">
            Privacy Policy
          </a>
        </p>
      </form>

      {/* Login Link */}
      <div className="text-center mt-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-hedera-600 hover:text-hedera-500 dark:text-hedera-400 dark:hover:text-hedera-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
