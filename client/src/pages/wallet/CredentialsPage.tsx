import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { credentialStorage } from '@/utils/db';
import { StoredCredential } from '@/types';

// Icons
import {
  IdentificationIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentArrowUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

/**
 * CredentialsPage Component
 * 
 * Features:
 * - List of all credentials
 * - Search and filter functionality
 * - Import new credentials
 * - Credential status indicators
 */
const CredentialsPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<StoredCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Available credential types (derived from credentials)
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  
  // Fetch credentials from local storage
  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        setIsLoading(true);
        const allCredentials = await credentialStorage.getAllCredentials();
        setCredentials(allCredentials);
        
        // Extract unique credential types
        const types = new Set<string>();
        allCredentials.forEach(cred => {
          if (cred.type && Array.isArray(cred.type)) {
            // Use the most specific type (last in array)
            const specificType = cred.type[cred.type.length - 1];
            if (specificType && typeof specificType === 'string') {
              types.add(specificType);
            }
          }
        });
        setAvailableTypes(Array.from(types));
        
      } catch (err: any) {
        console.error('Error fetching credentials:', err);
        setError('Failed to load credentials. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCredentials();
  }, []);
  
  // Apply filters and search
  useEffect(() => {
    let result = [...credentials];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(cred => cred.status === statusFilter);
    }
    
    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter(cred => {
        if (cred.type && Array.isArray(cred.type)) {
          return cred.type.includes(typeFilter);
        }
        return false;
      });
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(cred => {
        // Search in credential name
        const name = cred.metadata?.name || '';
        if (name.toLowerCase().includes(query)) return true;
        
        // Search in credential type
        const types = cred.type || [];
        if (types.some(type => typeof type === 'string' && type.toLowerCase().includes(query))) return true;
        
        // Search in issuer
        const issuerName = typeof cred.issuer === 'string' 
          ? cred.issuer 
          : cred.issuer.id || cred.metadata?.issuerName || '';
        if (issuerName.toLowerCase().includes(query)) return true;
        
        return false;
      });
    }
    
    setFilteredCredentials(result);
  }, [credentials, searchQuery, statusFilter, typeFilter]);
  
  // Handle credential import
  const handleImportCredential = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setImportError(null);
    
    try {
      const file = files[0];
      const text = await file.text();
      let credential;
      
      try {
        credential = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON format. Please upload a valid credential file.');
      }
      
      // Basic validation
      if (!credential.type || !Array.isArray(credential.type)) {
        throw new Error('Invalid credential: missing or invalid type property');
      }
      
      if (!credential.issuer) {
        throw new Error('Invalid credential: missing issuer property');
      }
      
      // Import the credential
      const imported = await credentialStorage.addCredential(credential);
      
      // Refresh the credentials list
      const allCredentials = await credentialStorage.getAllCredentials();
      setCredentials(allCredentials);
      
      // Close the modal
      setShowImportModal(false);
      
      // Navigate to the credential detail page
      navigate(`/wallet/credentials/${imported.localId}`);
      
    } catch (err: any) {
      console.error('Error importing credential:', err);
      setImportError(err.message || 'Failed to import credential. Please check the file format.');
    } finally {
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Handle import button click
  const handleImportClick = () => {
    setShowImportModal(true);
    setImportError(null);
  };
  
  // Format credential type for display
  const formatCredentialType = (credential: StoredCredential): string => {
    if (!credential.type || !Array.isArray(credential.type)) return 'Unknown';
    
    // Get the most specific type (last in array)
    const specificType = credential.type[credential.type.length - 1];
    if (!specificType) return 'Unknown';
    
    // Format the type string (e.g., "VerifiableCredential" -> "Verifiable Credential")
    return typeof specificType === 'string'
      ? specificType
          .replace(/([A-Z])/g, ' $1') // Add space before capital letters
          .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      : 'Unknown';
  };
  
  // Get issuer name
  const getIssuerName = (credential: StoredCredential): string => {
    if (typeof credential.issuer === 'string') {
      return credential.issuer;
    }
    
    return credential.issuer.id || credential.metadata?.issuerName || 'Unknown issuer';
  };
  
  // Render status badge
  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'expired':
        return (
          <span className="status-badge bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300">
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="status-badge bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-300">
            Revoked
          </span>
        );
      default:
        return (
          <span className="status-badge bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300">
            Active
          </span>
        );
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Credentials
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Manage your verifiable credentials
          </p>
        </div>
        
        <button 
          className="mt-4 sm:mt-0 btn-primary btn-sm flex items-center"
          onClick={handleImportClick}
        >
          <PlusCircleIcon className="h-4 w-4 mr-1" />
          Import Credential
        </button>
      </div>
      
      {/* Search and Filters */}
      <div className="wallet-card p-4">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
          {/* Search input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-neutral-400" />
            </div>
            <input
              type="text"
              className="form-input pl-10 w-full"
              placeholder="Search credentials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <XMarkIcon className="h-5 w-5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300" />
              </button>
            )}
          </div>
          
          {/* Filter toggle */}
          <button
            className="mt-3 md:mt-0 btn-outline btn-sm flex items-center"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FunnelIcon className="h-4 w-4 mr-1" />
            Filters
            <ChevronDownIcon className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        {/* Filter options */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status filter */}
            <div>
              <label htmlFor="status-filter" className="form-label">Status</label>
              <select
                id="status-filter"
                className="form-select w-full"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
            
            {/* Type filter */}
            <div>
              <label htmlFor="type-filter" className="form-label">Credential Type</label>
              <select
                id="type-filter"
                className="form-select w-full"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                {availableTypes.map((type, index) => (
                  <option key={index} value={type}>
                    {type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        
        {/* Results count */}
        <div className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          {!isLoading && (
            <>
              Showing {filteredCredentials.length} of {credentials.length} credentials
              {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
                <button
                  className="ml-2 text-hedera-600 hover:text-hedera-700 dark:text-hedera-400 dark:hover:text-hedera-300"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                >
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Credentials List */}
      <div className="wallet-card">
        {isLoading ? (
          <div className="animate-pulse space-y-4 p-4">
            <div className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <ExclamationCircleIcon className="h-12 w-12 text-error-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
              Error Loading Credentials
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {error}
            </p>
            <button
              className="btn-primary btn-sm"
              onClick={() => window.location.reload()}
            >
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              Retry
            </button>
          </div>
        ) : filteredCredentials.length === 0 ? (
          <div className="p-6 text-center">
            {credentials.length === 0 ? (
              <>
                <IdentificationIcon className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
                  No Credentials Found
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                  You don't have any credentials in your wallet yet.
                </p>
                <button
                  className="btn-primary btn-sm"
                  onClick={handleImportClick}
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1" />
                  Import Your First Credential
                </button>
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
                  No Matching Credentials
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                  No credentials match your current filters.
                </p>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {filteredCredentials.map((credential, index) => (
              <div 
                key={credential.localId || index}
                className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                onClick={() => navigate(`/wallet/credentials/${credential.localId}`)}
              >
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-hedera-100 dark:bg-hedera-900 flex items-center justify-center mr-3">
                    <IdentificationIcon className="h-6 w-6 text-hedera-600 dark:text-hedera-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <h3 className="text-base font-medium text-neutral-900 dark:text-white truncate mr-2">
                        {credential.metadata?.name || formatCredentialType(credential)}
                      </h3>
                      {renderStatusBadge(credential.status)}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center text-sm text-neutral-500 dark:text-neutral-400">
                      <span className="truncate">
                        Issued by: {getIssuerName(credential)}
                      </span>
                      <span className="hidden sm:inline mx-2">•</span>
                      <span>
                        {new Date(credential.imported).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <span className="text-neutral-400 dark:text-neutral-500">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-neutral-900 bg-opacity-75 transition-opacity"
              onClick={() => setShowImportModal(false)}
              aria-hidden="true"
            ></div>
            
            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-hedera-100 dark:bg-hedera-900 sm:mx-0 sm:h-10 sm:w-10">
                    <DocumentArrowUpIcon className="h-6 w-6 text-hedera-600 dark:text-hedera-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-neutral-900 dark:text-white">
                      Import Credential
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Select a JSON file containing a verifiable credential to import it into your wallet.
                      </p>
                    </div>
                    
                    <div className="mt-4">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="application/json,.json"
                        onChange={handleImportCredential}
                      />
                      <button
                        className="btn-outline w-full"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
                        Select Credential File
                      </button>
                    </div>
                    
                    {importError && (
                      <div className="mt-3 p-3 bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300 rounded-md text-sm">
                        <div className="flex">
                          <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                          <p>{importError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowImportModal(false)}
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

export default CredentialsPage;
