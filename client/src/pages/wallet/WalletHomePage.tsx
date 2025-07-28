import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { credentialStorage } from '@/utils/db';
import { StoredCredential } from '@/types';

// Icons
import {
  IdentificationIcon,
  QrCodeIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

/**
 * WalletHomePage Component
 * 
 * Dashboard view showing:
 * - User's DID
 * - Credential statistics
 * - Recent activity
 * - Quick actions
 */
const WalletHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [didCopied, setDidCopied] = useState(false);
  
  // Fetch credentials from local storage
  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        setIsLoading(true);
        const allCredentials = await credentialStorage.getAllCredentials();
        setCredentials(allCredentials);
      } catch (err: any) {
        console.error('Error fetching credentials:', err);
        setError('Failed to load credentials. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCredentials();
  }, []);
  
  // Copy DID to clipboard
  const copyDid = () => {
    if (user?.did) {
      navigator.clipboard.writeText(user.did);
      setDidCopied(true);
      setTimeout(() => setDidCopied(false), 2000);
    }
  };
  
  // Get user's first name for greeting
  const getFirstName = () => {
    if (!user?.name) return 'there';
    return user.name.split(' ')[0];
  };
  
  // Calculate credential statistics
  const credentialStats = {
    total: credentials.length,
    active: credentials.filter(c => c.status !== 'revoked' && c.status !== 'expired').length,
    expired: credentials.filter(c => c.status === 'expired').length,
    revoked: credentials.filter(c => c.status === 'revoked').length,
  };
  
  // Get recent credentials (last 3)
  const recentCredentials = credentials
    .sort((a, b) => new Date(b.imported).getTime() - new Date(a.imported).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Welcome, {getFirstName()}!
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Your digital identity wallet dashboard
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <button 
            className="btn-outline btn-sm flex items-center"
            onClick={() => navigate('/wallet/credentials')}
          >
            <IdentificationIcon className="h-4 w-4 mr-1" />
            View All Credentials
          </button>
          
          <button 
            className="btn-primary btn-sm flex items-center"
            onClick={() => navigate('/wallet/profile')}
          >
            <QrCodeIcon className="h-4 w-4 mr-1" />
            Share DID
          </button>
        </div>
      </div>
      
      {/* DID card */}
      <div className="wallet-card-highlight">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
              <ShieldCheckIcon className="h-5 w-5 mr-2 text-hedera-600" />
              Your Decentralized Identifier (DID)
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              This is your unique digital identity
            </p>
          </div>
          
          <button 
            className="mt-2 sm:mt-0 btn-outline btn-sm flex items-center self-start"
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
        
        <div className="mt-3 p-3 bg-neutral-100 dark:bg-neutral-700 rounded-lg overflow-x-auto">
          <p className="font-mono text-sm text-neutral-800 dark:text-neutral-200 did-format">
            {user?.did || 'Loading DID...'}
          </p>
        </div>
      </div>
      
      {/* Stats and quick actions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Credential stats */}
        <div className="wallet-card">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Credential Summary
          </h2>
          
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
              <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
              <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            </div>
          ) : error ? (
            <div className="text-error-600 dark:text-error-400 flex items-center">
              <ExclamationCircleIcon className="h-5 w-5 mr-2" />
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-100 dark:bg-neutral-700 p-3 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Total</p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">{credentialStats.total}</p>
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-700 p-3 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Active</p>
                  <p className="text-2xl font-bold text-success-600 dark:text-success-400">{credentialStats.active}</p>
                </div>
              </div>
              
              {(credentialStats.expired > 0 || credentialStats.revoked > 0) && (
                <div className="grid grid-cols-2 gap-4">
                  {credentialStats.expired > 0 && (
                    <div className="bg-warning-50 dark:bg-warning-900/30 p-3 rounded-lg">
                      <p className="text-sm text-warning-800 dark:text-warning-300">Expired</p>
                      <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">{credentialStats.expired}</p>
                    </div>
                  )}
                  {credentialStats.revoked > 0 && (
                    <div className="bg-error-50 dark:bg-error-900/30 p-3 rounded-lg">
                      <p className="text-sm text-error-800 dark:text-error-300">Revoked</p>
                      <p className="text-2xl font-bold text-error-600 dark:text-error-400">{credentialStats.revoked}</p>
                    </div>
                  )}
                </div>
              )}
              
              {credentialStats.total === 0 && (
                <div className="text-center py-4">
                  <p className="text-neutral-600 dark:text-neutral-400">
                    You don't have any credentials yet
                  </p>
                  <button
                    className="mt-2 btn-outline btn-sm"
                    onClick={() => navigate('/wallet/credentials')}
                  >
                    Add Your First Credential
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Quick actions */}
        <div className="wallet-card">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          
          <div className="space-y-3">
            <button
              className="w-full flex items-center justify-between p-3 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 transition-colors"
              onClick={() => navigate('/wallet/credentials')}
            >
              <span className="flex items-center">
                <PlusCircleIcon className="h-5 w-5 mr-3 text-hedera-600" />
                <span className="font-medium">Add New Credential</span>
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">→</span>
            </button>
            
            <button
              className="w-full flex items-center justify-between p-3 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 transition-colors"
              onClick={() => navigate('/wallet/profile')}
            >
              <span className="flex items-center">
                <QrCodeIcon className="h-5 w-5 mr-3 text-hedera-600" />
                <span className="font-medium">Share Your DID</span>
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
              <span className="flex items-center">
                <ArrowPathIcon className="h-5 w-5 mr-3 text-hedera-600" />
                <span className="font-medium">Backup Wallet</span>
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">→</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Recent activity */}
      {!isLoading && !error && credentials.length > 0 && (
        <div className="wallet-card">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          
          <div className="space-y-3">
            {recentCredentials.map((credential, index) => (
              <div 
                key={index}
                className="flex items-center p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
                onClick={() => navigate(`/wallet/credentials/${credential.localId}`)}
              >
                <div className="h-10 w-10 rounded-full bg-hedera-100 dark:bg-hedera-900 flex items-center justify-center mr-3">
                  <IdentificationIcon className="h-6 w-6 text-hedera-600 dark:text-hedera-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 dark:text-white truncate">
                    {credential.metadata?.name || credential.type[credential.type.length - 1] || 'Credential'}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                    {typeof credential.issuer === 'string' 
                      ? credential.issuer 
                      : credential.issuer.id || credential.metadata?.issuerName || 'Unknown issuer'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {new Date(credential.imported).toLocaleDateString()}
                  </p>
                  <span 
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      credential.status === 'expired' 
                        ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300' 
                        : credential.status === 'revoked'
                        ? 'bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-300'
                        : 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
                    }`}
                  >
                    {credential.status || 'Active'}
                  </span>
                </div>
              </div>
            ))}
            
            <div className="text-center">
              <button
                className="text-sm text-hedera-600 hover:text-hedera-700 dark:text-hedera-400 dark:hover:text-hedera-300 font-medium"
                onClick={() => navigate('/wallet/credentials')}
              >
                View All Credentials →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletHomePage;
