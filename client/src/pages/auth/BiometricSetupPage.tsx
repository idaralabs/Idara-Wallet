import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWebAuthn } from '@/hooks/useWebAuthn';

// Icons
import { 
  FingerPrintIcon, 
  ShieldCheckIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

/**
 * BiometricSetupPage Component
 * 
 * Allows users to set up WebAuthn (biometric) authentication after registration
 * Features:
 * - Clear explanation of biometric benefits
 * - Option to enable or skip
 * - Device compatibility check
 * - Success/error feedback
 */
const BiometricSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSupported, registerWebAuthn, error, clearError } = useWebAuthn();
  
  // Component state
  const [isLoading, setIsLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState<'initial' | 'success' | 'error'>('initial');
  const [setupMessage, setSetupMessage] = useState('');

  // Clear WebAuthn errors when unmounting
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Handle WebAuthn registration
  const handleEnableBiometrics = async () => {
    if (!user) {
      setSetupStatus('error');
      setSetupMessage('User information not available. Please try again later.');
      return;
    }

    setIsLoading(true);
    setSetupStatus('initial');
    setSetupMessage('');

    try {
      const success = await registerWebAuthn(user.id);
      
      if (success) {
        setSetupStatus('success');
        setSetupMessage('Biometric authentication set up successfully!');
        
        // Auto-navigate to wallet after successful setup
        setTimeout(() => {
          navigate('/wallet', { replace: true });
        }, 2000);
      } else {
        setSetupStatus('error');
        setSetupMessage(error || 'Failed to set up biometric authentication. Please try again.');
      }
    } catch (err: any) {
      setSetupStatus('error');
      setSetupMessage(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Skip biometric setup
  const handleSkip = () => {
    navigate('/wallet', { replace: true });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-hedera-50 dark:bg-hedera-900 rounded-full flex items-center justify-center mb-4">
          <FingerPrintIcon className="h-10 w-10 text-hedera-600 dark:text-hedera-400" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Set Up Biometric Login
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Use your device's biometric features for faster, more secure login
        </p>
      </div>

      {/* Device compatibility check */}
      {!isSupported && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 text-warning-800 dark:bg-warning-900/30 dark:border-warning-700 dark:text-warning-300">
          <div className="flex">
            <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
            <p>
              Your device or browser doesn't support biometric authentication. 
              You can still use email/phone verification to log in.
            </p>
          </div>
        </div>
      )}

      {/* Benefits section */}
      {isSupported && setupStatus === 'initial' && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-card p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Benefits of Biometric Login
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start">
              <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-neutral-700 dark:text-neutral-300">
                Enhanced security with your unique biometric data
              </span>
            </li>
            <li className="flex items-start">
              <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-neutral-700 dark:text-neutral-300">
                Quick login without typing codes or passwords
              </span>
            </li>
            <li className="flex items-start">
              <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-neutral-700 dark:text-neutral-300">
                Your biometric data never leaves your device
              </span>
            </li>
            <li className="flex items-start">
              <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-neutral-700 dark:text-neutral-300">
                Works with Face ID, Touch ID, Windows Hello, and other biometric systems
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* Success message */}
      {setupStatus === 'success' && (
        <div className="bg-success-50 border border-success-200 rounded-lg p-4 text-success-800 dark:bg-success-900/30 dark:border-success-700 dark:text-success-300">
          <div className="flex">
            <CheckCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
            <p>{setupMessage}</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {setupStatus === 'error' && (
        <div className="bg-error-50 border border-error-200 rounded-lg p-4 text-error-800 dark:bg-error-900/30 dark:border-error-700 dark:text-error-300">
          <div className="flex">
            <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
            <p>{setupMessage || error}</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
        {isSupported && setupStatus !== 'success' && (
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={handleEnableBiometrics}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Setting up...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <FingerPrintIcon className="h-5 w-5 mr-2" />
                Enable Biometric Login
              </span>
            )}
          </button>
        )}
        
        {setupStatus !== 'success' && (
          <button
            type="button"
            className={isSupported ? "btn-outline flex-1" : "btn-primary w-full"}
            onClick={handleSkip}
            disabled={isLoading}
          >
            <span className="flex items-center justify-center">
              {isSupported ? 'Skip for now' : 'Continue to Wallet'}
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </span>
          </button>
        )}
        
        {setupStatus === 'success' && (
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => navigate('/wallet', { replace: true })}
          >
            <span className="flex items-center justify-center">
              Continue to Wallet
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </span>
          </button>
        )}
      </div>

      {/* Privacy note */}
      {isSupported && setupStatus === 'initial' && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
          Your biometric data never leaves your device and is not stored on our servers.
          You can add or remove biometric authentication at any time from your profile settings.
        </p>
      )}
    </div>
  );
};

export default BiometricSetupPage;
