import Dexie, { Table } from 'dexie';
import { StoredCredential, DIDKeyPair, DatabaseSchema, VerifiableCredential } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * WalletDatabase class extends Dexie to provide typed access to IndexedDB
 * Stores credentials, keys, and settings for the wallet
 */
export class WalletDatabase extends Dexie {
  // Define tables with their types
  credentials!: Table<StoredCredential, string>;
  keys!: Table<DIDKeyPair, string>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('HederaIDWallet');
    
    // Define schema with indexes
    this.version(1).stores({
      credentials: 'localId, id, [type], issuer, issuanceDate, expirationDate, status, *tags, favorite',
      keys: 'id, type',
      settings: 'key'
    });
  }

  /**
   * Initialize the database with default settings
   */
  async initialize(): Promise<void> {
    // Check if database has been initialized before
    const initialized = await this.settings.get('initialized');
    
    if (!initialized) {
      // Set default settings
      await this.settings.bulkPut([
        { key: 'initialized', value: true },
        { key: 'encryptCredentials', value: true },
        { key: 'theme', value: 'light' },
        { key: 'lastBackup', value: null },
        { key: 'onboardingComplete', value: false }
      ]);
    }
  }
}

// Create database instance
const db = new WalletDatabase();

/**
 * Encrypt sensitive data using the Web Crypto API
 * @param data - Data to encrypt
 * @param key - Encryption key (optional, will use device-specific key if not provided)
 */
export async function encryptData(data: any, key?: CryptoKey): Promise<string> {
  try {
    // Convert data to string if it's not already
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Generate a random initialization vector
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Use provided key or get device key
    const encryptionKey = key || await getDeviceEncryptionKey();
    
    // Encrypt the data
    const encodedData = new TextEncoder().encode(dataString);
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      encryptionKey,
      encodedData
    );
    
    // Combine IV and encrypted data for storage
    const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
    combinedData.set(iv, 0);
    combinedData.set(new Uint8Array(encryptedData), iv.length);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...new Uint8Array(combinedData)));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data using the Web Crypto API
 * @param encryptedData - Encrypted data string (base64)
 * @param key - Decryption key (optional, will use device-specific key if not provided)
 */
export async function decryptData(encryptedData: string, key?: CryptoKey): Promise<any> {
  try {
    // Decode base64 string to array buffer
    const binaryString = atob(encryptedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);
    
    // Use provided key or get device key
    const decryptionKey = key || await getDeviceEncryptionKey();
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      decryptionKey,
      data
    );
    
    // Convert decrypted data to string and parse if it's JSON
    const decodedString = new TextDecoder().decode(decryptedData);
    try {
      return JSON.parse(decodedString);
    } catch {
      return decodedString;
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Get or create a device-specific encryption key
 * This key is derived from a device identifier and stored in IndexedDB
 */
export async function getDeviceEncryptionKey(): Promise<CryptoKey> {
  try {
    // Check if we already have a device key in settings
    const deviceKeyData = await db.settings.get('deviceEncryptionKey');
    
    if (deviceKeyData?.value) {
      // Convert stored key to CryptoKey
      const keyData = Uint8Array.from(atob(deviceKeyData.value), c => c.charCodeAt(0));
      return crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }
    
    // Generate a device-specific identifier
    // For MVP, we'll use a random UUID and store it
    // In production, this could be derived from hardware identifiers or secure storage
    const deviceId = uuidv4();
    
    // Derive a key from the device ID
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(deviceId),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Use PBKDF2 to derive a strong key
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true, // extractable
      ['encrypt', 'decrypt']
    );
    
    // Export key for storage
    const rawKey = await crypto.subtle.exportKey('raw', key);
    const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
    
    // Store the key and salt
    await db.settings.put({
      key: 'deviceEncryptionKey',
      value: keyBase64
    });
    
    await db.settings.put({
      key: 'deviceEncryptionSalt',
      value: btoa(String.fromCharCode(...salt))
    });
    
    return key;
  } catch (error) {
    console.error('Failed to get device encryption key:', error);
    throw new Error('Failed to initialize encryption');
  }
}

/**
 * Credential storage operations
 */
export const credentialStorage = {
  /**
   * Store a verifiable credential
   * @param credential - The credential to store
   * @param encrypt - Whether to encrypt the credential (defaults to setting)
   */
  async storeCredential(credential: VerifiableCredential, encrypt?: boolean): Promise<string> {
    try {
      // Check if encryption should be used
      const encryptionSetting = await db.settings.get('encryptCredentials');
      const shouldEncrypt = encrypt ?? encryptionSetting?.value ?? true;
      
      // Generate a local ID for the credential
      const localId = credential.id || uuidv4();
      
      // Prepare credential for storage
      const storedCredential: StoredCredential = {
        ...credential,
        localId,
        imported: new Date().toISOString(),
        encrypted: shouldEncrypt
      };
      
      // Encrypt credential if needed
      if (shouldEncrypt) {
        // Extract metadata that doesn't need encryption
        const { localId, id, type, issuer, issuanceDate, expirationDate, status, metadata } = storedCredential;
        
        // Create a metadata object for search and display
        const searchableData = {
          localId, id, type, 
          issuer: typeof issuer === 'string' ? issuer : issuer.id,
          issuanceDate, expirationDate, status, metadata
        };
        
        // Encrypt the full credential
        const encryptedData = await encryptData(credential);
        
        // Store a version with searchable metadata and encrypted content
        await db.credentials.put({
          ...searchableData,
          encrypted: true,
          encryptedData,
          credentialSubject: { id: credential.credentialSubject.id } // Store just the subject ID
        } as any);
      } else {
        // Store unencrypted
        await db.credentials.put(storedCredential);
      }
      
      return localId;
    } catch (error) {
      console.error('Failed to store credential:', error);
      throw new Error('Failed to store credential');
    }
  },
  
  /**
   * Get a credential by ID
   * @param id - Local ID of the credential
   */
  async getCredential(id: string): Promise<StoredCredential | null> {
    try {
      const credential = await db.credentials.get(id);
      
      if (!credential) {
        return null;
      }
      
      // If credential is encrypted, decrypt it
      if (credential.encrypted && (credential as any).encryptedData) {
        const encryptedData = (credential as any).encryptedData;
        const decryptedCredential = await decryptData(encryptedData);
        
        // Merge decrypted data with metadata
        return {
          ...decryptedCredential,
          localId: credential.localId,
          imported: credential.imported,
          lastUsed: credential.lastUsed,
          favorite: credential.favorite,
          tags: credential.tags,
          encrypted: true
        };
      }
      
      return credential;
    } catch (error) {
      console.error('Failed to get credential:', error);
      throw new Error('Failed to retrieve credential');
    }
  },
  
  /**
   * Get all credentials (with optional filtering)
   * @param options - Filter options
   */
  async getAllCredentials(options?: {
    type?: string[];
    issuer?: string;
    status?: string;
    favorite?: boolean;
    tags?: string[];
  }): Promise<StoredCredential[]> {
    try {
      let query = db.credentials.toCollection();
      
      // Apply filters if provided
      if (options) {
        query = query.filter(cred => {
          // Type filter (match any of the provided types)
          if (options.type && options.type.length > 0) {
            const credTypes = Array.isArray(cred.type) ? cred.type : [cred.type];
            if (!options.type.some(t => credTypes.includes(t))) {
              return false;
            }
          }
          
          // Issuer filter
          if (options.issuer) {
            const credIssuer = typeof cred.issuer === 'string' 
              ? cred.issuer 
              : cred.issuer.id;
            if (credIssuer !== options.issuer) {
              return false;
            }
          }
          
          // Status filter
          if (options.status && cred.status !== options.status) {
            return false;
          }
          
          // Favorite filter
          if (options.favorite !== undefined && cred.favorite !== options.favorite) {
            return false;
          }
          
          // Tags filter (credential must have all specified tags)
          if (options.tags && options.tags.length > 0) {
            if (!cred.tags || !options.tags.every(tag => cred.tags?.includes(tag))) {
              return false;
            }
          }
          
          return true;
        });
      }
      
      const credentials = await query.toArray();
      
      // Decrypt credentials if needed
      const decryptedCredentials = await Promise.all(
        credentials.map(async (cred) => {
          if (cred.encrypted && (cred as any).encryptedData) {
            try {
              const encryptedData = (cred as any).encryptedData;
              const decryptedCredential = await decryptData(encryptedData);
              
              // Merge decrypted data with metadata
              return {
                ...decryptedCredential,
                localId: cred.localId,
                imported: cred.imported,
                lastUsed: cred.lastUsed,
                favorite: cred.favorite,
                tags: cred.tags,
                encrypted: true
              };
            } catch (error) {
              console.error(`Failed to decrypt credential ${cred.localId}:`, error);
              // Return credential with placeholder for encrypted data
              return {
                ...cred,
                credentialSubject: {
                  id: cred.credentialSubject?.id,
                  _encrypted: true
                }
              };
            }
          }
          
          return cred;
        })
      );
      
      return decryptedCredentials;
    } catch (error) {
      console.error('Failed to get credentials:', error);
      throw new Error('Failed to retrieve credentials');
    }
  },
  
  /**
   * Update a credential
   * @param id - Local ID of the credential
   * @param updates - Partial credential updates
   */
  async updateCredential(id: string, updates: Partial<StoredCredential>): Promise<boolean> {
    try {
      const credential = await this.getCredential(id);
      
      if (!credential) {
        return false;
      }
      
      const updatedCredential = { ...credential, ...updates };
      
      // If credential is encrypted, re-encrypt with updates
      if (credential.encrypted) {
        // Extract metadata that doesn't need encryption
        const { localId, id, type, issuer, issuanceDate, expirationDate, status, metadata } = updatedCredential;
        
        // Create a metadata object for search and display
        const searchableData = {
          localId, id, type, 
          issuer: typeof issuer === 'string' ? issuer : issuer.id,
          issuanceDate, expirationDate, status, metadata,
          favorite: updatedCredential.favorite,
          tags: updatedCredential.tags,
          imported: updatedCredential.imported,
          lastUsed: new Date().toISOString()
        };
        
        // Encrypt the full credential
        const encryptedData = await encryptData(updatedCredential);
        
        // Store a version with searchable metadata and encrypted content
        await db.credentials.put({
          ...searchableData,
          encrypted: true,
          encryptedData,
          credentialSubject: { id: updatedCredential.credentialSubject.id } // Store just the subject ID
        } as any);
      } else {
        // Update unencrypted
        await db.credentials.put({
          ...updatedCredential,
          lastUsed: new Date().toISOString()
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to update credential:', error);
      throw new Error('Failed to update credential');
    }
  },
  
  /**
   * Delete a credential
   * @param id - Local ID of the credential
   */
  async deleteCredential(id: string): Promise<boolean> {
    try {
      await db.credentials.delete(id);
      return true;
    } catch (error) {
      console.error('Failed to delete credential:', error);
      throw new Error('Failed to delete credential');
    }
  },
  
  /**
   * Mark a credential as used
   * @param id - Local ID of the credential
   */
  async markCredentialAsUsed(id: string): Promise<boolean> {
    try {
      const credential = await db.credentials.get(id);
      
      if (!credential) {
        return false;
      }
      
      await db.credentials.update(id, {
        lastUsed: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error('Failed to mark credential as used:', error);
      throw new Error('Failed to update credential usage');
    }
  },
  
  /**
   * Toggle favorite status of a credential
   * @param id - Local ID of the credential
   */
  async toggleFavorite(id: string): Promise<boolean> {
    try {
      const credential = await db.credentials.get(id);
      
      if (!credential) {
        return false;
      }
      
      await db.credentials.update(id, {
        favorite: !credential.favorite
      });
      
      return true;
    } catch (error) {
      console.error('Failed to toggle favorite status:', error);
      throw new Error('Failed to update credential');
    }
  },
  
  /**
   * Add a tag to a credential
   * @param id - Local ID of the credential
   * @param tag - Tag to add
   */
  async addTag(id: string, tag: string): Promise<boolean> {
    try {
      const credential = await db.credentials.get(id);
      
      if (!credential) {
        return false;
      }
      
      const tags = credential.tags || [];
      
      // Only add if tag doesn't exist
      if (!tags.includes(tag)) {
        await db.credentials.update(id, {
          tags: [...tags, tag]
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to add tag:', error);
      throw new Error('Failed to update credential tags');
    }
  },
  
  /**
   * Remove a tag from a credential
   * @param id - Local ID of the credential
   * @param tag - Tag to remove
   */
  async removeTag(id: string, tag: string): Promise<boolean> {
    try {
      const credential = await db.credentials.get(id);
      
      if (!credential || !credential.tags) {
        return false;
      }
      
      await db.credentials.update(id, {
        tags: credential.tags.filter(t => t !== tag)
      });
      
      return true;
    } catch (error) {
      console.error('Failed to remove tag:', error);
      throw new Error('Failed to update credential tags');
    }
  }
};

/**
 * Key storage operations
 */
export const keyStorage = {
  /**
   * Store a key pair
   * @param keyPair - The key pair to store
   * @param encrypt - Whether to encrypt the private key
   */
  async storeKeyPair(keyPair: DIDKeyPair, encrypt: boolean = true): Promise<string> {
    try {
      // Always encrypt private keys
      if (encrypt && keyPair.privateKeyMultibase) {
        const privateKeyData = keyPair.privateKeyMultibase;
        const encryptedPrivateKey = await encryptData(privateKeyData);
        
        // Store with encrypted private key
        await db.keys.put({
          ...keyPair,
          privateKeyMultibase: undefined, // Remove from main object
          privateKeyJwk: undefined, // Remove from main object
          encryptedPrivateKey, // Add encrypted version
          encrypted: true
        } as any);
      } else {
        // Store without encryption (not recommended for production)
        await db.keys.put(keyPair);
      }
      
      return keyPair.id;
    } catch (error) {
      console.error('Failed to store key pair:', error);
      throw new Error('Failed to store key pair');
    }
  },
  
  /**
   * Get a key pair by ID
   * @param id - ID of the key pair
   * @param includePrivateKey - Whether to include and decrypt the private key
   */
  async getKeyPair(id: string, includePrivateKey: boolean = false): Promise<DIDKeyPair | null> {
    try {
      const keyPair = await db.keys.get(id);
      
      if (!keyPair) {
        return null;
      }
      
      // If private key is encrypted and requested, decrypt it
      if (includePrivateKey && (keyPair as any).encrypted && (keyPair as any).encryptedPrivateKey) {
        const encryptedPrivateKey = (keyPair as any).encryptedPrivateKey;
        const privateKeyData = await decryptData(encryptedPrivateKey);
        
        return {
          ...keyPair,
          privateKeyMultibase: privateKeyData
        };
      }
      
      return keyPair;
    } catch (error) {
      console.error('Failed to get key pair:', error);
      throw new Error('Failed to retrieve key pair');
    }
  },
  
  /**
   * Get all key pairs
   * @param includePrivateKeys - Whether to include and decrypt private keys
   */
  async getAllKeyPairs(includePrivateKeys: boolean = false): Promise<DIDKeyPair[]> {
    try {
      const keyPairs = await db.keys.toArray();
      
      if (!includePrivateKeys) {
        return keyPairs;
      }
      
      // Decrypt private keys if requested
      return Promise.all(
        keyPairs.map(async (keyPair) => {
          if ((keyPair as any).encrypted && (keyPair as any).encryptedPrivateKey) {
            try {
              const encryptedPrivateKey = (keyPair as any).encryptedPrivateKey;
              const privateKeyData = await decryptData(encryptedPrivateKey);
              
              return {
                ...keyPair,
                privateKeyMultibase: privateKeyData
              };
            } catch (error) {
              console.error(`Failed to decrypt key ${keyPair.id}:`, error);
              return keyPair;
            }
          }
          
          return keyPair;
        })
      );
    } catch (error) {
      console.error('Failed to get key pairs:', error);
      throw new Error('Failed to retrieve key pairs');
    }
  },
  
  /**
   * Delete a key pair
   * @param id - ID of the key pair
   */
  async deleteKeyPair(id: string): Promise<boolean> {
    try {
      await db.keys.delete(id);
      return true;
    } catch (error) {
      console.error('Failed to delete key pair:', error);
      throw new Error('Failed to delete key pair');
    }
  }
};

/**
 * Settings storage operations
 */
export const settingsStorage = {
  /**
   * Get a setting value
   * @param key - Setting key
   * @param defaultValue - Default value if setting not found
   */
  async getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      const setting = await db.settings.get(key);
      return setting?.value ?? defaultValue;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return defaultValue;
    }
  },
  
  /**
   * Set a setting value
   * @param key - Setting key
   * @param value - Setting value
   */
  async setSetting<T>(key: string, value: T): Promise<boolean> {
    try {
      await db.settings.put({ key, value });
      return true;
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      return false;
    }
  },
  
  /**
   * Delete a setting
   * @param key - Setting key
   */
  async deleteSetting(key: string): Promise<boolean> {
    try {
      await db.settings.delete(key);
      return true;
    } catch (error) {
      console.error(`Failed to delete setting ${key}:`, error);
      return false;
    }
  },
  
  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Record<string, any>> {
    try {
      const settings = await db.settings.toArray();
      return settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, any>);
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return {};
    }
  }
};

/**
 * Database backup and restore operations
 */
export const databaseBackup = {
  /**
   * Export database to JSON
   * @param includeCredentials - Whether to include credentials
   * @param includeKeys - Whether to include keys
   * @param includeSettings - Whether to include settings
   */
  async exportDatabase({
    includeCredentials = true,
    includeKeys = true,
    includeSettings = true
  } = {}): Promise<string> {
    try {
      const data: any = {};
      
      if (includeCredentials) {
        data.credentials = await db.credentials.toArray();
      }
      
      if (includeKeys) {
        data.keys = await db.keys.toArray();
      }
      
      if (includeSettings) {
        data.settings = await db.settings.toArray();
      }
      
      // Add export metadata
      data.exportMetadata = {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };
      
      return JSON.stringify(data);
    } catch (error) {
      console.error('Failed to export database:', error);
      throw new Error('Failed to export database');
    }
  },
  
  /**
   * Import database from JSON
   * @param jsonData - JSON data to import
   * @param options - Import options
   */
  async importDatabase(
    jsonData: string,
    {
      overwrite = false,
      importCredentials = true,
      importKeys = true,
      importSettings = true
    } = {}
  ): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData);
      
      // Validate import data
      if (!data.exportMetadata) {
        throw new Error('Invalid import data: missing export metadata');
      }
      
      // Start transaction
      return await db.transaction('rw', [db.credentials, db.keys, db.settings], async () => {
        // Import credentials
        if (importCredentials && data.credentials) {
          if (overwrite) {
            await db.credentials.clear();
          }
          await db.credentials.bulkPut(data.credentials);
        }
        
        // Import keys
        if (importKeys && data.keys) {
          if (overwrite) {
            await db.keys.clear();
          }
          await db.keys.bulkPut(data.keys);
        }
        
        // Import settings
        if (importSettings && data.settings) {
          if (overwrite) {
            await db.settings.clear();
          }
          await db.settings.bulkPut(data.settings);
        }
        
        // Update last backup timestamp
        await db.settings.put({
          key: 'lastBackup',
          value: new Date().toISOString()
        });
        
        return true;
      });
    } catch (error) {
      console.error('Failed to import database:', error);
      throw new Error('Failed to import database');
    }
  },
  
  /**
   * Clear all data from the database
   */
  async clearDatabase(): Promise<boolean> {
    try {
      await db.transaction('rw', [db.credentials, db.keys, db.settings], async () => {
        await db.credentials.clear();
        await db.keys.clear();
        await db.settings.clear();
      });
      
      // Re-initialize with default settings
      await db.initialize();
      
      return true;
    } catch (error) {
      console.error('Failed to clear database:', error);
      throw new Error('Failed to clear database');
    }
  }
};

/**
 * Initialize the database
 * This function should be called when the app starts
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await db.initialize();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error('Database initialization failed');
  }
}

// Export database instance and utilities
export default db;
