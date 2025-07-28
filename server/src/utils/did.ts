import { 
  DIDMethod, 
  DIDCreationOptions, 
  DIDKeyPair, 
  DIDDocument 
} from '../types';
import { 
  Client, 
  PrivateKey, 
  AccountId, 
  AccountCreateTransaction, 
  Hbar, 
  AccountInfoQuery 
} from '@hashgraph/sdk';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Base58 encoding/decoding utilities
const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode a Buffer to Base58
 */
function encodeBase58(buffer: Buffer): string {
  let result = '';
  let num = BigInt(0);
  
  for (const byte of buffer) {
    num = (num << BigInt(8)) + BigInt(byte);
  }
  
  while (num > BigInt(0)) {
    const remainder = Number(num % BigInt(58));
    num = num / BigInt(58);
    result = base58Chars[remainder] + result;
  }
  
  // Add leading '1's for leading zeros in the buffer
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result = '1' + result;
  }
  
  return result;
}

/**
 * Encode a Buffer to Multibase format (used in did:key)
 * @param buffer - The buffer to encode
 * @param prefix - The multibase prefix (e.g., 'z' for base58btc)
 */
function encodeMultibase(buffer: Buffer, prefix: string = 'z'): string {
  return prefix + encodeBase58(buffer);
}

/**
 * Convert a public key to a did:key identifier
 * @param publicKey - The public key as a Buffer
 * @param keyType - The key type ('ed25519' or 'secp256k1')
 */
function publicKeyToDIDKey(publicKey: Buffer, keyType: string = 'ed25519'): string {
  // For Ed25519 keys, we need to prepend the multicodec prefix 0xed01
  let multicodecKey: Buffer;
  
  if (keyType === 'ed25519') {
    const prefix = Buffer.from([0xed, 0x01]);
    multicodecKey = Buffer.concat([prefix, publicKey]);
  } else if (keyType === 'secp256k1') {
    const prefix = Buffer.from([0xe7, 0x01]);
    multicodecKey = Buffer.concat([prefix, publicKey]);
  } else {
    throw new Error(`Unsupported key type: ${keyType}`);
  }
  
  // Encode with multibase (z = base58btc)
  const multibaseEncoded = encodeMultibase(multicodecKey);
  
  return `did:key:${multibaseEncoded}`;
}

/**
 * Generate a key pair for DID
 * @param keyType - The key type to generate ('ed25519' or 'secp256k1')
 */
async function generateKeyPair(keyType: string = 'ed25519'): Promise<DIDKeyPair> {
  if (keyType === 'ed25519') {
    // Generate Ed25519 key pair
    const keyPair = crypto.generateKeyPairSync('ed25519');
    
    // Export keys in raw format
    const publicKeyRaw = keyPair.publicKey.export({ format: 'der', type: 'spki' });
    const privateKeyRaw = keyPair.privateKey.export({ format: 'der', type: 'pkcs8' });
    
    // Extract the actual key bytes (removing DER encoding)
    // Ed25519 public key is 32 bytes
    const publicKeyBuffer = extractEd25519PublicKeyFromDer(publicKeyRaw);
    const privateKeyBuffer = extractEd25519PrivateKeyFromDer(privateKeyRaw);
    
    // Export keys in JWK format for easier use with Web Crypto API
    const publicKeyJwk = {
      kty: 'OKP',
      crv: 'Ed25519',
      x: Buffer.from(publicKeyBuffer).toString('base64url'),
      key_ops: ['verify'],
      alg: 'EdDSA'
    };
    
    const privateKeyJwk = {
      kty: 'OKP',
      crv: 'Ed25519',
      x: Buffer.from(publicKeyBuffer).toString('base64url'),
      d: Buffer.from(privateKeyBuffer).toString('base64url'),
      key_ops: ['sign'],
      alg: 'EdDSA'
    };
    
    return {
      id: uuidv4(),
      type: 'Ed25519VerificationKey2020',
      publicKeyMultibase: encodeMultibase(publicKeyBuffer),
      publicKeyJwk,
      privateKeyMultibase: encodeMultibase(privateKeyBuffer),
      privateKeyJwk
    };
  } else if (keyType === 'secp256k1') {
    // Generate secp256k1 key pair
    const keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1'
    });
    
    // Export keys in raw format
    const publicKeyRaw = keyPair.publicKey.export({ format: 'der', type: 'spki' });
    const privateKeyRaw = keyPair.privateKey.export({ format: 'der', type: 'pkcs8' });
    
    // Extract the actual key bytes (removing DER encoding)
    const publicKeyBuffer = extractSecp256k1PublicKeyFromDer(publicKeyRaw);
    const privateKeyBuffer = extractSecp256k1PrivateKeyFromDer(privateKeyRaw);
    
    // Export keys in JWK format
    const publicKeyJwk = {
      kty: 'EC',
      crv: 'secp256k1',
      x: Buffer.from(publicKeyBuffer.slice(1, 33)).toString('base64url'),
      y: Buffer.from(publicKeyBuffer.slice(33, 65)).toString('base64url'),
      key_ops: ['verify'],
      alg: 'ES256K'
    };
    
    const privateKeyJwk = {
      kty: 'EC',
      crv: 'secp256k1',
      x: Buffer.from(publicKeyBuffer.slice(1, 33)).toString('base64url'),
      y: Buffer.from(publicKeyBuffer.slice(33, 65)).toString('base64url'),
      d: Buffer.from(privateKeyBuffer).toString('base64url'),
      key_ops: ['sign'],
      alg: 'ES256K'
    };
    
    return {
      id: uuidv4(),
      type: 'EcdsaSecp256k1VerificationKey2019',
      publicKeyMultibase: encodeMultibase(publicKeyBuffer),
      publicKeyJwk,
      privateKeyMultibase: encodeMultibase(privateKeyBuffer),
      privateKeyJwk
    };
  } else {
    throw new Error(`Unsupported key type: ${keyType}`);
  }
}

/**
 * Extract Ed25519 public key from DER encoded format
 */
function extractEd25519PublicKeyFromDer(der: Buffer): Buffer {
  // Ed25519 public key is 32 bytes at the end of the DER
  // This is a simplified extraction - in production, use a proper ASN.1 parser
  return der.slice(der.length - 32);
}

/**
 * Extract Ed25519 private key from DER encoded format
 */
function extractEd25519PrivateKeyFromDer(der: Buffer): Buffer {
  // Ed25519 private key is 32 bytes
  // This is a simplified extraction - in production, use a proper ASN.1 parser
  // The actual position may vary depending on the DER structure
  const keyData = der.toString('hex');
  const keyStart = keyData.indexOf('0420') + 4; // 0x04 = OCTET STRING, 0x20 = 32 bytes
  const keyEnd = keyStart + 64; // 32 bytes = 64 hex chars
  return Buffer.from(keyData.substring(keyStart, keyEnd), 'hex');
}

/**
 * Extract secp256k1 public key from DER encoded format
 */
function extractSecp256k1PublicKeyFromDer(der: Buffer): Buffer {
  // This is a simplified extraction - in production, use a proper ASN.1 parser
  // For secp256k1, we need to find the actual key bytes
  let offset = 0;
  
  // Skip sequence header
  offset += 2;
  
  // Skip algorithm identifier sequence
  const algIdLen = der[offset + 1];
  offset += 2 + algIdLen;
  
  // Skip bit string header
  offset += 2;
  
  // The rest is the public key
  return der.slice(offset);
}

/**
 * Extract secp256k1 private key from DER encoded format
 */
function extractSecp256k1PrivateKeyFromDer(der: Buffer): Buffer {
  // This is a simplified extraction - in production, use a proper ASN.1 parser
  // For secp256k1, the private key is 32 bytes
  const keyData = der.toString('hex');
  const keyStart = keyData.indexOf('0420') + 4; // 0x04 = OCTET STRING, 0x20 = 32 bytes
  const keyEnd = keyStart + 64; // 32 bytes = 64 hex chars
  return Buffer.from(keyData.substring(keyStart, keyEnd), 'hex');
}

/**
 * Create a DID document for a did:key identifier
 * @param did - The did:key identifier
 * @param keyPair - The key pair associated with the DID
 */
function createDIDKeyDocument(did: string, keyPair: DIDKeyPair): DIDDocument {
  const verificationMethodId = `${did}#${keyPair.id}`;
  
  const verificationMethod = {
    id: verificationMethodId,
    type: keyPair.type,
    controller: did,
    publicKeyMultibase: keyPair.publicKeyMultibase
  };
  
  return {
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    capabilityInvocation: [verificationMethodId],
    capabilityDelegation: [verificationMethodId],
    keyAgreement: [verificationMethodId]
  };
}

/**
 * Initialize Hedera client based on environment variables
 */
function getHederaClient(): Client {
  // Check for required environment variables
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  const network = process.env.HEDERA_NETWORK || 'testnet';
  
  if (!operatorId || !operatorKey) {
    throw new Error('Hedera operator ID and key must be provided in environment variables');
  }
  
  // Create and return the client
  let client: Client;
  
  if (network === 'mainnet') {
    client = Client.forMainnet();
  } else if (network === 'testnet') {
    client = Client.forTestnet();
  } else if (network === 'previewnet') {
    client = Client.forPreviewnet();
  } else {
    throw new Error(`Unsupported Hedera network: ${network}`);
  }
  
  // Set the operator account ID and key
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  return client;
}

/**
 * Create a Hedera account with the given private key
 * @param privateKey - The private key for the account
 */
async function createHederaAccount(privateKey: PrivateKey): Promise<AccountId> {
  const client = getHederaClient();
  
  try {
    // Create a new account with the given key
    const transaction = new AccountCreateTransaction()
      .setKey(privateKey.publicKey)
      .setInitialBalance(Hbar.fromTinybars(100)) // Minimal balance
      .freezeWith(client);
    
    // Sign and submit the transaction
    const signedTx = await transaction.sign(privateKey);
    const response = await signedTx.execute(client);
    
    // Get the account ID from the receipt
    const receipt = await response.getReceipt(client);
    const accountId = receipt.accountId;
    
    if (!accountId) {
      throw new Error('Failed to create Hedera account: accountId is null');
    }
    
    return accountId;
  } catch (error) {
    console.error('Error creating Hedera account:', error);
    throw error;
  } finally {
    client.close();
  }
}

/**
 * Get account info from Hedera
 * @param accountId - The account ID to query
 */
async function getHederaAccountInfo(accountId: AccountId): Promise<any> {
  const client = getHederaClient();
  
  try {
    // Query the account info
    const query = new AccountInfoQuery()
      .setAccountId(accountId);
    
    // Execute the query
    const accountInfo = await query.execute(client);
    
    return accountInfo;
  } catch (error) {
    console.error('Error getting Hedera account info:', error);
    throw error;
  } finally {
    client.close();
  }
}

/**
 * Create a did:hedera identifier
 * @param accountId - The Hedera account ID
 * @param network - The Hedera network (testnet, mainnet, previewnet)
 */
function createHederaDID(accountId: string, network: string = 'testnet'): string {
  return `did:hedera:${network}:${accountId}`;
}

/**
 * Create a DID document for a did:hedera identifier
 * @param did - The did:hedera identifier
 * @param keyPair - The key pair associated with the DID
 */
function createHederaDIDDocument(did: string, keyPair: DIDKeyPair): DIDDocument {
  const verificationMethodId = `${did}#${keyPair.id}`;
  
  const verificationMethod = {
    id: verificationMethodId,
    type: keyPair.type,
    controller: did,
    publicKeyJwk: keyPair.publicKeyJwk
  };
  
  return {
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    capabilityInvocation: [verificationMethodId],
    capabilityDelegation: [verificationMethodId]
  };
}

/**
 * Generate a DID with the specified method
 * @param options - Options for DID creation
 */
export async function generateDID(options: DIDCreationOptions = { method: DIDMethod.KEY }): Promise<{
  did: string;
  didDocument: DIDDocument;
  keyPair: DIDKeyPair;
}> {
  const keyType = options.keyType || 'ed25519';
  const keyPair = await generateKeyPair(keyType);
  
  if (options.method === DIDMethod.KEY) {
    // Create did:key
    const publicKeyBuffer = Buffer.from(keyPair.publicKeyMultibase.substring(1), 'base58');
    const did = publicKeyToDIDKey(publicKeyBuffer, keyType);
    const didDocument = createDIDKeyDocument(did, keyPair);
    
    return { did, didDocument, keyPair };
  } else if (options.method === DIDMethod.HEDERA) {
    // Create did:hedera
    const network = options.network || 'testnet';
    
    // Convert the key pair to Hedera format
    let privateKey: PrivateKey;
    
    if (keyType === 'ed25519') {
      // Extract private key bytes from multibase
      const privateKeyBase58 = keyPair.privateKeyMultibase.substring(1); // Remove 'z' prefix
      const privateKeyBytes = Buffer.from(privateKeyBase58, 'base58');
      
      // Create Hedera private key
      privateKey = PrivateKey.fromBytes(privateKeyBytes);
    } else {
      throw new Error(`Unsupported key type for Hedera: ${keyType}`);
    }
    
    // Create a Hedera account with this key
    const accountId = await createHederaAccount(privateKey);
    
    // Create the DID
    const did = createHederaDID(accountId.toString(), network);
    const didDocument = createHederaDIDDocument(did, keyPair);
    
    return { did, didDocument, keyPair };
  } else {
    throw new Error(`Unsupported DID method: ${options.method}`);
  }
}

/**
 * Resolve a DID to its DID Document
 * @param did - The DID to resolve
 */
export async function resolveDID(did: string): Promise<DIDDocument | null> {
  if (did.startsWith('did:key:')) {
    // For did:key, we can derive the document from the DID itself
    // This is a simplified implementation - in production, use a proper DID resolver
    const publicKeyMultibase = did.split(':')[2];
    const keyPair: DIDKeyPair = {
      id: uuidv4(),
      type: 'Ed25519VerificationKey2020',
      publicKeyMultibase
    };
    
    return createDIDKeyDocument(did, keyPair);
  } else if (did.startsWith('did:hedera:')) {
    // For did:hedera, we need to query the Hedera network
    const parts = did.split(':');
    if (parts.length < 4) {
      throw new Error(`Invalid did:hedera format: ${did}`);
    }
    
    const network = parts[2];
    const accountId = parts[3];
    
    try {
      // Query the account info
      const accountInfo = await getHederaAccountInfo(AccountId.fromString(accountId));
      
      // Extract the public key
      const publicKey = accountInfo.key.toString();
      
      // Create a key pair object
      const keyPair: DIDKeyPair = {
        id: uuidv4(),
        type: 'Ed25519VerificationKey2020',
        publicKeyMultibase: publicKey
      };
      
      return createHederaDIDDocument(did, keyPair);
    } catch (error) {
      console.error(`Error resolving did:hedera: ${error}`);
      return null;
    }
  } else {
    throw new Error(`Unsupported DID method: ${did}`);
  }
}

/**
 * Check if a DID is valid
 * @param did - The DID to validate
 */
export function isValidDID(did: string): boolean {
  // Basic validation for supported DID methods
  if (did.startsWith('did:key:')) {
    const parts = did.split(':');
    return parts.length === 3 && parts[2].length > 0;
  } else if (did.startsWith('did:hedera:')) {
    const parts = did.split(':');
    return parts.length === 4 && 
           ['testnet', 'mainnet', 'previewnet'].includes(parts[2]) && 
           parts[3].length > 0;
  }
  
  return false;
}

/**
 * Extract public key from a DID
 * @param did - The DID to extract from
 */
export async function extractPublicKeyFromDID(did: string): Promise<Buffer | null> {
  try {
    if (did.startsWith('did:key:')) {
      // For did:key, the public key is encoded in the DID itself
      const multibaseKey = did.split(':')[2];
      // Remove the multibase prefix ('z')
      const base58Key = multibaseKey.substring(1);
      // Decode from base58
      const keyBytes = Buffer.from(base58Key, 'base58');
      // Remove the multicodec prefix (0xed01 for Ed25519)
      return keyBytes.slice(2);
    } else if (did.startsWith('did:hedera:')) {
      // For did:hedera, we need to resolve the DID document
      const didDocument = await resolveDID(did);
      if (!didDocument || !didDocument.verificationMethod || didDocument.verificationMethod.length === 0) {
        return null;
      }
      
      // Get the first verification method
      const verificationMethod = didDocument.verificationMethod[0];
      
      if ('publicKeyMultibase' in verificationMethod) {
        const multibaseKey = verificationMethod.publicKeyMultibase;
        // Remove the multibase prefix ('z')
        const base58Key = multibaseKey.substring(1);
        // Decode from base58
        const keyBytes = Buffer.from(base58Key, 'base58');
        // Remove the multicodec prefix if present
        return keyBytes.length > 2 ? keyBytes.slice(2) : keyBytes;
      } else if ('publicKeyJwk' in verificationMethod) {
        // Extract from JWK
        const jwk = verificationMethod.publicKeyJwk;
        if (jwk.kty === 'OKP' && jwk.crv === 'Ed25519') {
          return Buffer.from(jwk.x, 'base64url');
        } else if (jwk.kty === 'EC' && jwk.crv === 'secp256k1') {
          // For secp256k1, we need to reconstruct the compressed public key
          const x = Buffer.from(jwk.x, 'base64url');
          const y = Buffer.from(jwk.y, 'base64url');
          
          // Determine the prefix based on whether y is even or odd
          const prefix = y[y.length - 1] % 2 === 0 ? 0x02 : 0x03;
          
          // Create the compressed public key: prefix + x
          return Buffer.concat([Buffer.from([prefix]), x]);
        }
      }
      
      return null;
    } else {
      throw new Error(`Unsupported DID method: ${did}`);
    }
  } catch (error) {
    console.error(`Error extracting public key from DID: ${error}`);
    return null;
  }
}

export default {
  generateDID,
  resolveDID,
  isValidDID,
  extractPublicKeyFromDID
};
