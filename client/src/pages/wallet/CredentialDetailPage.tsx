import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { credentialStorage } from '@/utils/db';
import { StoredCredential } from '@/types';

// Icons
import {
  ArrowLeftIcon,
  IdentificationIcon,
  CheckBadgeIcon,
  XCircleIcon,
  ClockIcon,
  BuildingLibraryIcon,
  CalendarIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  QrCodeIcon,
  ShareIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

/**
 * CredentialDetailPage Component
 * 
 * Displays detailed information about a specific credential:
 * - Credential metadata and content
 * - Issuer information
 * - Verification status
 * - Actions (share, delete)
 */
const CredentialDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // State
  const [credential, setCredential] = useState<StoredCredential | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    status: 'success' | 'error' | 'warning' | null;
    message: string;
  }>({ status: null, message: '' });
  
  // Fetch credential from storage
  useEffect(() => {
    const fetchCredential = async () => {
      if (!id) {
        setError('Credential ID is missing');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const cred = await credentialStorage.getCredential(id);
        
        if (!cred) {
          setError('Credential not found');
        } else {
          setCredential(cred);
        }
      } catch (err: any) {
        console.error('Error fetching credential:', err);
        setError(err.message || 'Failed to load credential');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCredential();
  }, [id]);
  
  // Handle credential verification
  const handleVerify = async () => {
    if (!credential) return;
    
    setIsVerifying(true);
    setVerificationResult({ status: null, message: '' });
    
    try {
      // In a real app, this would call a verification service
      // For the MVP, we'll simulate verification based on credential status
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      
      if (credential.status === 'revoked') {
        setVerificationResult({
          status: 'error',
          message: 'This credential has been revoked by the issuer.'
        });
      } else if (credential.status === 'expired') {
        setVerificationResult({
          status: 'warning',
          message: 'This credential has expired and is no longer valid.'
        });
      } else {
        setVerificationResult({
          status: 'success',
          message: 'Credential successfully verified with the issuer.'
        });
      }
    } catch (err: any) {
      setVerificationResult({
        status: 'error',
        message: err.message || 'Verification failed. Please try again.'
      });
    } finally {
      setIsVerifying(false);
    }
  };
  
  // Handle credential deletion
  const handleDelete = async () => {
    if (!credential) return;
    
    try {
      await credentialStorage.deleteCredential(credential.localId);
      navigate('/wallet/credentials');
    } catch (err: any) {
      console.error('Error deleting credential:', err);
      // Show error notification
    }
  };
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  // Get credential type display name
  const getCredentialTypeName = () => {
    if (!credential?.type || !Array.isArray(credential.type)) return 'Unknown Type';
    
    // Get the most specific type (last in array)
    const specificType = credential.type[credential.type.length - 1];
    if (!specificType) return 'Unknown Type';
    
    // Format the type string (e.g., "VerifiableCredential" -> "Verifiable Credential")
    return typeof specificType === 'string'
      ? specificType
          .replace(/([A-Z])/g, ' $1') // Add space before capital letters
          .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      : 'Unknown Type';
  };
  
  // Get issuer name
  const getIssuerName = () => {
    if (!credential) return 'Unknown Issuer';
    
    if (typeof credential.issuer === 'string') {
      return credential.issuer;
    }
    
    return credential.issuer.name || 
           credential.metadata?.issuerName || 
           credential.issuer.id || 
           'Unknown Issuer';
  };
  
  // Get issuer ID
  const getIssuerId = () => {
    if (!credential) return '';
    
    if (typeof credential.issuer === 'string') {
      return credential.issuer;
    }
    
    return credential.issuer.id || '';
  };
  
  // Get status badge
  const getStatusBadge = () => {
    switch (credential?.status) {
      case 'expired':
        return (
          <span className="status-badge bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300 flex items-center">
            <ClockIcon className="h-4 w-4 mr-1" />
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="status-badge bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-300 flex items-center">
            <XCircleIcon className="h-4 w-4 mr-1" />
            Revoked
          </span>
        );
      default:
        return (
          <span className="status-badge bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300 flex items-center">
            <CheckBadgeIcon className="h-4 w-4 mr-1" />
            Active
          </span>
        );
    }
  };
  
  // Get verification result badge
  const getVerificationBadge = () => {
    switch (verificationResult.status) {
      case 'success':
        return (
          <div className="flex items-center text-success-600 dark:text-success-400">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            <span>{verificationResult.message}</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-error-600 dark:text-error-400">
            <XCircleIcon className="h-5 w-5 mr-2" />
            <span>{verificationResult.message}</span>
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center text-warning-600 dark:text-warning-400">
            <ExclamationCircleIcon className="h-5 w-5 mr-2" />
            <span>{verificationResult.message}</span>
          </div>
        );
      default:
        return null;
    }
  };
  
  // Render credential subject
  const renderCredentialSubject = () => {
    if (!credential?.credentialSubject) return null;
    
    const subject = credential.credentialSubject;
    
    return (
      <div className="space-y-4">
        {Object.entries(subject).map(([key, value]) => {
          // Skip id field as it's usually the holder's DID
          if (key === 'id') return null;
          
          // Format key for display
          const formattedKey = key
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
          
          // Format value based on type
          let formattedValue = '';
          if (typeof value === 'string') {
            formattedValue = value;
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            formattedValue = String(value);
          } else if (value instanceof Date) {
            formattedValue = formatDate(value.toISOString());
          } else if (value === null) {
            formattedValue = 'N/A';
          } else if (typeof value === 'object') {
            formattedValue = JSON.stringify(value);
          }
          
          return (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center">
              <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-full sm:w-1/3 mb-1 sm:mb-0">
                {formattedKey}
              </div>
              <div className="text-neutral-900 dark:text-white w-full sm:w-2/3 break-words">
                {formattedValue}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-hedera-600 rounded-full border-t-transparent"></div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="wallet-card p-6 text-center">
        <ExclamationCircleIcon className="h-12 w-12 text-error-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
          {error}
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Unable to load the credential details.
        </p>
        <div className="flex justify-center space-x-4">
          <button
            className="btn-outline btn-sm"
            onClick={() => navigate('/wallet/credentials')}
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Credentials
          </button>
          <button
            className="btn-primary btn-sm"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  // No credential found
  if (!credential) {
    return (
      <div className="wallet-card p-6 text-center">
        <ExclamationCircleIcon className="h-12 w-12 text-warning-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
          Credential Not Found
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          The credential you're looking for doesn't exist or has been removed.
        </p>
        <button
          className="btn-primary btn-sm"
          onClick={() => navigate('/wallet/credentials')}
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Credentials
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center">
        <button
          className="mr-4 p-1 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          onClick={() => navigate('/wallet/credentials')}
          aria-label="Back to credentials"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Credential Details
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            View and manage this credential
          </p>
        </div>
      </div>
      
      {/* Credential header card */}
      <div className="wallet-card-highlight">
        <div className="flex flex-col sm:flex-row sm:items-center">
          <div className="h-14 w-14 rounded-full bg-hedera-100 dark:bg-hedera-900 flex items-center justify-center mr-4 mb-4 sm:mb-0">
            <IdentificationIcon className="h-8 w-8 text-hedera-600 dark:text-hedera-400" />
          </div>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2 sm:mb-0">
                {credential.metadata?.name || getCredentialTypeName()}
              </h2>
              {getStatusBadge()}
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Issued by: {getIssuerName()}
            </p>
          </div>
        </div>
        
        {/* Quick actions */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className="btn-outline btn-sm flex items-center"
            onClick={handleVerify}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </>
            ) : (
              <>
                <CheckBadgeIcon className="h-4 w-4 mr-1" />
                Verify
              </>
            )}
          </button>
          
          <button
            className="btn-outline btn-sm flex items-center"
            onClick={() => setShowShareModal(true)}
          >
            <ShareIcon className="h-4 w-4 mr-1" />
            Share
          </button>
          
          <button
            className="btn-outline btn-sm flex items-center"
            onClick={() => setShowJsonModal(true)}
          >
            <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
            View JSON
          </button>
          
          <button
            className="btn-error btn-sm flex items-center"
            onClick={() => setShowDeleteModal(true)}
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Delete
          </button>
        </div>
        
        {/* Verification result */}
        {verificationResult.status && (
          <div className="mt-4 p-3 rounded-lg bg-neutral-100 dark:bg-neutral-700">
            {getVerificationBadge()}
          </div>
        )}
      </div>
      
      {/* Credential details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credential information */}
        <div className="wallet-card">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Credential Information
          </h3>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-full sm:w-1/3 mb-1 sm:mb-0">
                Type
              </div>
              <div className="text-neutral-900 dark:text-white w-full sm:w-2/3">
                {getCredentialTypeName()}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-full sm:w-1/3 mb-1 sm:mb-0">
                ID
              </div>
              <div className="text-neutral-900 dark:text-white w-full sm:w-2/3 break-words">
                {credential.id || 'N/A'}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-full sm:w-1/3 mb-1 sm:mb-0">
                Issued Date
              </div>
              <div className="text-neutral-900 dark:text-white w-full sm:w-2/3">
                {formatDate(credential.issuanceDate)}
              </div>
            </div>
            
            {credential.expirationDate && (
              <div className="flex flex-col sm:flex-row sm:items-center">
                <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-full sm:w-1/3 mb-1 sm:mb-0">
                  Expiration Date
                </div>
                <div className="text-neutral-900 dark:text-white w-full sm:w-2/3">
                  {formatDate(credential.expirationDate)}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-full sm:w-1/3 mb-1 sm:mb-0">
                Added to Wallet
              </div>
              <div className="text-neutral-900 dark:text-white w-full sm:w-2/3">
                {formatDate(credential.imported)}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-full sm:w-1/3 mb-1 sm:mb-0">
                Status
              </div>
              <div className="text-neutral-900 dark:text-white w-full sm:w-2/3">
                {getStatusBadge()}
              </div>
            </div>
          </div>
        </div>
        
        {/* Issuer information */}
        <div className="wallet-card">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Issuer Information
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center mr-3">
                <BuildingLibraryIcon className="h-6 w-6 text-neutral-500" />
              </div>
              <div>
                <h4 className="font-medium text-neutral-900 dark:text-white">
                  {getIssuerName()}
                </h4>
                {credential.metadata?.issuerUrl && (
                  <a 
                    href={credential.metadata.issuerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-hedera-600 hover:text-hedera-700 dark:text-hedera-400 dark:hover:text-hedera-300"
                  >
                    Visit website
                  </a>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-full sm:w-1/3 mb-1 sm:mb-0">
                Issuer ID
              </div>
              <div className="text-neutral-900 dark:text-white w-full sm:w-2/3 break-words font-mono text-sm">
                {getIssuerId()}
              </div>
            </div>
            
            {credential.metadata?.issuerDescription && (
              <div className="flex flex-col sm:flex-row">
                <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-full sm:w-1/3 mb-1 sm:mb-0">
                  Description
                </div>
                <div className="text-neutral-900 dark:text-white w-full sm:w-2/3">
                  {credential.metadata.issuerDescription}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Credential subject */}
      <div className="wallet-card">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
          Credential Content
        </h3>
        
        {renderCredentialSubject()}
      </div>
      
      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-neutral-900 bg-opacity-75 transition-opacity"
              onClick={() => setShowDeleteModal(false)}
              aria-hidden="true"
            ></div>
            
            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-error-100 dark:bg-error-900 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationCircleIcon className="h-6 w-6 text-error-600 dark:text-error-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-neutral-900 dark:text-white">
                      Delete Credential
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Are you sure you want to delete this credential? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="btn-error sm:ml-3"
                  onClick={handleDelete}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="btn-outline mt-3 sm:mt-0"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* JSON Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-neutral-900 bg-opacity-75 transition-opacity"
              onClick={() => setShowJsonModal(false)}
              aria-hidden="true"
            ></div>
            
            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-neutral-900 dark:text-white">
                    Credential JSON
                  </h3>
                  <button
                    type="button"
                    className="bg-white dark:bg-neutral-800 rounded-md text-neutral-400 hover:text-neutral-500 dark:hover:text-neutral-300 focus:outline-none"
                    onClick={() => setShowJsonModal(false)}
                  >
                    <span className="sr-only">Close</span>
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="bg-neutral-100 dark:bg-neutral-700 p-4 rounded-lg overflow-auto max-h-96">
                  <pre className="text-xs font-mono text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                    {JSON.stringify(credential, null, 2)}
                  </pre>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(credential, null, 2));
                      // You could add a toast notification here
                    }}
                  >
                    <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                    Copy to Clipboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-neutral-900 bg-opacity-75 transition-opacity"
              onClick={() => setShowShareModal(false)}
              aria-hidden="true"
            ></div>
            
            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-neutral-900 dark:text-white">
                    Share Credential
                  </h3>
                  <button
                    type="button"
                    className="bg-white dark:bg-neutral-800 rounded-md text-neutral-400 hover:text-neutral-500 dark:hover:text-neutral-300 focus:outline-none"
                    onClick={() => setShowShareModal(false)}
                  >
                    <span className="sr-only">Close</span>
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="text-center mb-4">
                  <div className="bg-neutral-100 dark:bg-neutral-700 p-4 rounded-lg inline-block">
                    <QrCodeIcon className="h-32 w-32 text-neutral-500 mx-auto" />
                  </div>
                  <p className="mt-2 text-neutral-600 dark:text-neutral-400 text-sm">
                    QR code sharing will be available in a future update
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-700 p-3 rounded-lg">
                    <div className="flex">
                      <InformationCircleIcon className="h-5 w-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mr-2" />
                      <p className="text-sm text-warning-800 dark:text-warning-300">
                        Only share your credentials with trusted parties. Once shared, you cannot control how the information is used.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setShowShareModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        // This would typically trigger the actual sharing process
                        alert('Sharing functionality will be implemented in a future version');
                        setShowShareModal(false);
                      }}
                    >
                      <ShareIcon className="h-4 w-4 mr-1" />
                      Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CredentialDetailPage;
