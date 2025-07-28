import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import QRCode from 'qrcode.react';

// Icons
import {
  UserCircleIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  FingerPrintIcon,
  KeyIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

/**
 * ProfilePage Component
 * 
 * Features:
 * - Display user information
 * - Show DID with QR code for sharing
 * - Manage biometric authentication settings
 * - Basic account management
 */
const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, updateUserProfile } = useAuth();
  const { 
    isSupported: isWebAuthnSupported, 
    credentials: webAuthnCredentials, 
    registerWebAuthn, 
    deleteCredential,
    isLoading: isWebAuthnLoading,
    error: webAuthnError,
    clearError
  } = useWebAuthn();
  
  // State
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [didCopied, setDidCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddBiometricModal, setShowAddBiometricModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [isAddingBiometric, setIsAddingBiometric] = useState(false);
  const [addBiometricError, setAddBiometricError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  
  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
  }, [user]);
  
  // Copy DID to clipboard
  const copyDid = () => {
    if (user?.did) {
      navigator.clipboard.writeText(user.did);
      setDidCopied(true);
      setTimeout(() => setDidCopied(false), 2000);
    }
  };
  
  // Handle profile update
  const handleUpdateProfile = async () => {
    if (!user) return;
    
    try {
      await updateUserProfile({ name });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      // Show error notification
    }
  };
  
  // Handle add biometric device
  const handleAddBiometric = async () => {
    if (!user) return;
    
    setIsAddingBiometric(true);
    setAddBiometricError(null);
    
    try {
      const success = await registerWebAuthn(user.id, newDeviceName || undefined);
      
      if (success) {
        setShowAddBiometricModal(false);
        setNewDeviceName('');
      } else if (webAuthnError) {
        setAddBiometricError(webAuthnError);
      }
    } catch (error: any) {
      setAddBiometricError(error.message || 'Failed to register biometric device');
    } finally {
      setIsAddingBiometric(false);
    }
  };
  
  // Handle delete biometric device
  const handleDeleteBiometric = async (credentialId: string) => {
    try {
      await deleteCredential(credentialId);
    } catch (error) {
      console.error('Failed to delete biometric device:', error);
      // Show error notification
    }
  };
  
  // Handle account deletion
  const handleDeleteAccount = async () => {
    // In a real app, this would call an API to delete the account
    try {
      // await deleteAccount();
      logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to delete account:', error);
      // Show error notification
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-hedera-600 rounded-full border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Profile
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          Manage your account and identity settings
        </p>
      </div>
      
      {/* Profile Information */}
      <div className="wallet-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Personal Information
          </h2>
          
          {isEditing ? (
            <div className="mt-2 sm:mt-0 flex space-x-2">
              <button
                className="btn-outline btn-sm"
                onClick={() => {
                  setIsEditing(false);
                  setName(user.name || '');
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={handleUpdateProfile}
              >
                Save Changes
              </button>
            </div>
          ) : (
            <button
              className="mt-2 sm:mt-0 btn-outline btn-sm"
              onClick={() => setIsEditing(true)}
            >
              Edit Profile
            </button>
          )}
        </div>
        
        <div className="space-y-4">
          {/* Profile picture and name */}
          <div className="flex flex-col sm:flex-row sm:items-center">
            <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-6">
              <div className="h-20 w-20 rounded-full bg-hedera-600 text-white flex items-center justify-center text-xl font-medium">
                {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
              </div>
            </div>
            
            <div className="flex-grow">
              {isEditing ? (
                <div>
                  <label htmlFor="name" className="form-label">Name</label>
                  <input
                    id="name"
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-center">
                    <UserCircleIcon className="h-5 w-5 text-neutral-500 mr-2" />
                    <span className="text-lg font-medium text-neutral-900 dark:text-white">
                      {user.name || 'No name set'}
                    </span>
                  </div>
                  
                  {user.email && (
                    <div className="flex items-center mt-2">
                      <EnvelopeIcon className="h-5 w-5 text-neutral-500 mr-2" />
                      <span className="text-neutral-700 dark:text-neutral-300">
                        {user.email}
                      </span>
                    </div>
                  )}
                  
                  {user.phone && (
                    <div className="flex items-center mt-2">
                      <DevicePhoneMobileIcon className="h-5 w-5 text-neutral-500 mr-2" />
                      <span className="text-neutral-700 dark:text-neutral-300">
                        {user.phone}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Account info */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
              Account Information
            </h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Account created</span>
                <span className="text-neutral-900 dark:text-white">
                  {user.createdAt ? formatDate(user.createdAt) : 'Unknown'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Last login</span>
                <span className="text-neutral-900 dark:text-white">
                  {user.lastLogin ? formatDate(user.lastLogin) : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* DID Information */}
      <div className="wallet-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
            <ShieldCheckIcon className="h-5 w-5 mr-2 text-hedera-600" />
            Decentralized Identifier (DID)
          </h2>
          
          <div className="mt-2 sm:mt-0 flex space-x-2">
            <button 
              className="btn-outline btn-sm flex items-center"
              onClick={copyDid}
            >
              {didCopied ? (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-1 text-success-500" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                  Copy DID
                </>
              )}
            </button>
            
            <button 
              className="btn-primary btn-sm flex items-center"
              onClick={() => setShowQrModal(true)}
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Show QR Code
            </button>
          </div>
        </div>
        
        <div className="p-3 bg-neutral-100 dark:bg-neutral-700 rounded-lg overflow-x-auto">
          <p className="font-mono text-sm text-neutral-800 dark:text-neutral-200 did-format">
            {user.did || 'No DID available'}
          </p>
        </div>
        
        <div className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          <p>
            Your DID is a unique identifier that represents your digital identity. You can share it with others to receive verifiable credentials or establish secure connections.
          </p>
        </div>
      </div>
      
      {/* Biometric Authentication */}
      <div className="wallet-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
            <FingerPrintIcon className="h-5 w-5 mr-2 text-hedera-600" />
            Biometric Authentication
          </h2>
          
          {isWebAuthnSupported && (
            <button 
              className="mt-2 sm:mt-0 btn-outline btn-sm flex items-center"
              onClick={() => setShowAddBiometricModal(true)}
              disabled={isWebAuthnLoading}
            >
              <PlusCircleIcon className="h-4 w-4 mr-1" />
              Add Device
            </button>
          )}
        </div>
        
        {!isWebAuthnSupported ? (
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 text-warning-800 dark:bg-warning-900/30 dark:border-warning-700 dark:text-warning-300">
            <div className="flex">
              <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
              <p>
                Your device or browser doesn't support biometric authentication. 
                You can still use email/phone verification to log in.
              </p>
            </div>
          </div>
        ) : isWebAuthnLoading ? (
          <div className="text-center py-6">
            <div className="animate-spin h-8 w-8 border-4 border-hedera-600 rounded-full border-t-transparent mx-auto"></div>
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">
              Loading biometric devices...
            </p>
          </div>
        ) : webAuthnCredentials.length === 0 ? (
          <div className="text-center py-6">
            <FingerPrintIcon className="h-12 w-12 text-neutral-400 mx-auto mb-2" />
            <h3 className="text-base font-medium text-neutral-900 dark:text-white mb-1">
              No Biometric Devices Registered
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4 max-w-md mx-auto">
              Add your device's biometric authentication (fingerprint, face recognition) for faster and more secure login.
            </p>
            <button 
              className="btn-primary btn-sm"
              onClick={() => setShowAddBiometricModal(true)}
            >
              <FingerPrintIcon className="h-4 w-4 mr-1" />
              Set Up Biometric Login
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {webAuthnCredentials.map((credential) => (
              <div key={credential.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-hedera-100 dark:bg-hedera-900 flex items-center justify-center mr-3">
                      <FingerPrintIcon className="h-6 w-6 text-hedera-600 dark:text-hedera-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-neutral-900 dark:text-white">
                        {credential.name || 'Biometric Device'}
                      </h3>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Added on {formatDate(credential.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    className="text-error-600 hover:text-error-800 dark:text-error-400 dark:hover:text-error-300"
                    onClick={() => handleDeleteBiometric(credential.id)}
                    aria-label="Remove device"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Account Management */}
      <div className="wallet-card">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
          Account Management
        </h2>
        
        <div className="space-y-4">
          <button
            className="w-full flex items-center justify-between p-3 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 transition-colors"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <span className="flex items-center text-neutral-900 dark:text-white">
              <KeyIcon className="h-5 w-5 mr-3 text-neutral-500" />
              <span className="font-medium">Sign Out</span>
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">→</span>
          </button>
          
          <button
            className="w-full flex items-center justify-between p-3 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 transition-colors"
            onClick={() => {
              // This would typically open a backup/export modal
              alert('Backup functionality will be implemented in a future version');
            }}
          >
            <span className="flex items-center text-neutral-900 dark:text-white">
              <ArrowPathIcon className="h-5 w-5 mr-3 text-neutral-500" />
              <span className="font-medium">Backup Wallet</span>
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">→</span>
          </button>
          
          <button
            className="w-full flex items-center justify-between p-3 rounded-lg bg-error-50 hover:bg-error-100 dark:bg-error-900/20 dark:hover:bg-error-900/30 transition-colors"
            onClick={() => setShowDeleteModal(true)}
          >
            <span className="flex items-center text-error-700 dark:text-error-400">
              <TrashIcon className="h-5 w-5 mr-3" />
              <span className="font-medium">Delete Account</span>
            </span>
            <span className="text-error-500 dark:text-error-400">→</span>
          </button>
        </div>
      </div>
      
      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-neutral-900 bg-opacity-75 transition-opacity"
              onClick={() => setShowQrModal(false)}
              aria-hidden="true"
            ></div>
            
            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white dark:bg-neutral-800 rounded-md text-neutral-400 hover:text-neutral-500 dark:hover:text-neutral-300 focus:outline-none"
                  onClick={() => setShowQrModal(false)}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="text-center">
                  <h3 className="text-lg leading-6 font-medium text-neutral-900 dark:text-white mb-4">
                    Share Your DID
                  </h3>
                  
                  <div className="bg-white p-4 rounded-lg inline-block mb-4">
                    {user.did ? (
                      <QRCode 
                        value={user.did}
                        size={200}
                        level="H"
                        renderAs="svg"
                        includeMargin={true}
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                      />
                    ) : (
                      <div className="h-48 w-48 flex items-center justify-center bg-neutral-100">
                        <p className="text-neutral-500">No DID available</p>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    Scan this QR code to share your decentralized identifier (DID) with others.
                  </p>
                  
                  <div className="p-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg overflow-x-auto mb-4">
                    <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 truncate">
                      {user.did || 'No DID available'}
                    </p>
                  </div>
                  
                  <button 
                    className="btn-outline btn-sm flex items-center mx-auto"
                    onClick={copyDid}
                  >
                    {didCopied ? (
                      <>
                        <CheckCircleIcon className="h-4 w-4 mr-1 text-success-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                        Copy DID
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Biometric Modal */}
      {showAddBiometricModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-neutral-900 bg-opacity-75 transition-opacity"
              onClick={() => !isAddingBiometric && setShowAddBiometricModal(false)}
              aria-hidden="true"
            ></div>
            
            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-hedera-100 dark:bg-hedera-900 sm:mx-0 sm:h-10 sm:w-10">
                    <FingerPrintIcon className="h-6 w-6 text-hedera-600 dark:text-hedera-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-neutral-900 dark:text-white">
                      Add Biometric Device
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Register your device's biometric authentication for faster and more secure login.
                      </p>
                    </div>
                    
                    <div className="mt-4">
                      <label htmlFor="device-name" className="form-label">
                        Device Name (Optional)
                      </label>
                      <input
                        type="text"
                        id="device-name"
                        className="form-input"
                        placeholder="e.g., My iPhone, Work Laptop"
                        value={newDeviceName}
                        onChange={(e) => setNewDeviceName(e.target.value)}
                        disabled={isAddingBiometric}
                      />
                    </div>
                    
                    {addBiometricError && (
                      <div className="mt-3 p-3 bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300 rounded-md text-sm">
                        <div className="flex">
                          <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                          <p>{addBiometricError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="btn-primary sm:ml-3"
                  onClick={handleAddBiometric}
                  disabled={isAddingBiometric}
                >
                  {isAddingBiometric ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Registering...
                    </span>
                  ) : (
                    'Register Device'
                  )}
                </button>
                <button
                  type="button"
                  className="btn-outline mt-3 sm:mt-0"
                  onClick={() => setShowAddBiometricModal(false)}
                  disabled={isAddingBiometric}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Account Modal */}
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
                      Delete Account
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Are you sure you want to delete your account? This action cannot be undone.
                        All your data, including your DID and credentials, will be permanently removed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="btn-error sm:ml-3"
                  onClick={handleDeleteAccount}
                >
                  Delete Account
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
    </div>
  );
};

export default ProfilePage;
