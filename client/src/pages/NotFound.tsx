import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  ExclamationTriangleIcon, 
  HomeIcon, 
  ArrowLeftIcon 
} from '@heroicons/react/24/outline';

/**
 * NotFound Component
 * 
 * Displays a 404 error page when users navigate to a non-existent route
 * with options to return to appropriate locations based on auth state
 */
const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Go back to previous page
  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-20 h-20 bg-warning-100 dark:bg-warning-900/30 rounded-full flex items-center justify-center mb-6">
          <ExclamationTriangleIcon className="h-12 w-12 text-warning-600 dark:text-warning-400" />
        </div>
        
        <h1 className="text-6xl font-bold text-neutral-900 dark:text-white mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Page Not Found</h2>
        
        <p className="text-neutral-600 dark:text-neutral-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleGoBack}
            className="btn-outline w-full flex items-center justify-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Go Back
          </button>
          
          {isAuthenticated ? (
            <Link to="/wallet" className="btn-primary w-full flex items-center justify-center">
              <HomeIcon className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn-primary w-full flex items-center justify-center">
              <HomeIcon className="h-4 w-4 mr-2" />
              Return to Login
            </Link>
          )}
        </div>
      </div>
      
      <div className="mt-12 text-sm text-neutral-500 dark:text-neutral-500">
        <p>
          Need help? <Link to="/login" className="text-hedera-600 hover:text-hedera-700 dark:text-hedera-400 dark:hover:text-hedera-300">Contact Support</Link>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
