import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { OtpDeliveryMethod } from '@/types';

// Import icons
import { 
  EnvelopeIcon, 
  DevicePhoneMobileIcon, 
  ArrowLeftIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

/**
 * VerifyOtpPage Component
 * 
 * Handles OTP verification for both login and registration flows
 * Features:
 * - OTP input with auto-focus and auto-submit
 * - Resend OTP functionality
 * - Timer for OTP expiration
 * - Different flows for login vs registration
 */
const VerifyOtpPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOtp, login } = useAuth();
  
  // Get state from navigation
  const state = location.state as {
    otpId: string;
    method: OtpDeliveryMethod;
    identifier: string;
    identifierType: 'email' | 'phone';
    name?: string;
    purpose: 'login' | 'registration';
  };

  // If no state, redirect to login
  useEffect(() => {
    if (!state || !state.otpId) {
      navigate('/login', { replace: true });
    }
  }, [state, navigate]);

  // Component state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  
  // References for OTP inputs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer for OTP expiration
  useEffect(() => {
    if (!timeLeft) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft]);

  // Format time remaining
  const formatTimeLeft = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    // Update OTP array
    const newOtp = [...otp];
    newOtp[index] = value.slice(0, 1); // Take only first character
    setOtp(newOtp);

    // Clear error when user types
    if (error) setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (value && index === 5) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  // Handle key down events for navigation between inputs
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // If current input is empty and backspace is pressed, focus previous input
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP verification
  const handleVerify = async (fullOtp?: string) => {
    const otpCode = fullOtp || otp.join('');
    
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyOtp(
        state.otpId,
        otpCode,
        state.purpose === 'registration', // Register user if purpose is registration
        state.name // Pass name for registration
      );

      if (result.success) {
        if (result.supportsWebAuthn && result.isNewUser) {
          // New user with WebAuthn support - offer biometric setup
          navigate('/biometric-setup', { replace: true });
        } else {
          // Existing user or no WebAuthn support - go to wallet
          navigate('/wallet', { replace: true });
        }
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    setResendLoading(true);
    setError(null);

    try {
      const { otpId, method } = await login(
        state.identifierType === 'email' ? state.identifier : undefined,
        state.identifierType === 'phone' ? state.identifier : undefined
      );

      // Update state with new OTP ID
      navigate('.', {
        replace: true,
        state: {
          ...state,
          otpId,
          method
        }
      });

      // Reset timer and OTP inputs
      setTimeLeft(600);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      
      // Focus first input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // Format identifier for display
  const formatIdentifier = () => {
    if (state?.identifierType === 'email') {
      // Mask email: jo***@example.com
      const [username, domain] = state.identifier.split('@');
      if (username && domain) {
        const maskedUsername = username.slice(0, 2) + '•'.repeat(Math.min(username.length - 2, 3));
        return `${maskedUsername}@${domain}`;
      }
    } else if (state?.identifierType === 'phone') {
      // Mask phone: +1•••••••1234
      const digits = state.identifier.replace(/\D/g, '');
      if (digits.length > 4) {
        const lastFour = digits.slice(-4);
        const countryCode = state.identifier.split(digits.slice(0, -4))[0];
        return `${countryCode}${'•'.repeat(digits.length - 4)}${lastFour}`;
      }
    }
    return state?.identifier || '';
  };

  if (!state) {
    return null; // Will redirect to login via useEffect
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Verify Your Identity</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          We've sent a verification code to
        </p>
        <div className="mt-1 flex justify-center items-center text-neutral-900 dark:text-white font-medium">
          {state.identifierType === 'email' ? (
            <EnvelopeIcon className="h-5 w-5 mr-1 text-neutral-500" />
          ) : (
            <DevicePhoneMobileIcon className="h-5 w-5 mr-1 text-neutral-500" />
          )}
          {formatIdentifier()}
        </div>
      </div>

      {/* OTP Input */}
      <div className="space-y-4">
        <div>
          <label htmlFor="otp-1" className="sr-only">Verification code</label>
          <div className="flex justify-center space-x-2 sm:space-x-4">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength={1}
                id={`otp-${index + 1}`}
                className="otp-input"
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                autoFocus={index === 0}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                disabled={isLoading}
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>
          {error && (
            <p className="form-error text-center mt-2" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Timer and Resend */}
        <div className="text-center">
          {canResend ? (
            <button
              type="button"
              className="text-sm text-hedera-600 hover:text-hedera-700 dark:text-hedera-400 dark:hover:text-hedera-300 font-medium flex items-center justify-center mx-auto"
              onClick={handleResendOtp}
              disabled={resendLoading}
            >
              {resendLoading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-1" />
                  Resend verification code
                </>
              )}
            </button>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Code expires in <span className="font-medium">{formatTimeLeft()}</span>
            </p>
          )}
        </div>

        {/* Verify Button */}
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => handleVerify()}
          disabled={isLoading || otp.join('').length !== 6}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </span>
          ) : (
            'Verify'
          )}
        </button>
      </div>

      {/* Back Link */}
      <div className="text-center">
        <Link
          to={state.purpose === 'registration' ? '/register' : '/login'}
          className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to {state.purpose === 'registration' ? 'registration' : 'login'}
        </Link>
      </div>
    </div>
  );
};

export default VerifyOtpPage;
