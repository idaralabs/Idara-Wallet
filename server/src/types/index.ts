/**
 * Core type definitions for the Hedera ID Wallet MVP
 */

// ==================== User Types ====================

/**
 * User authentication methods
 */
export enum AuthMethod {
  EMAIL = 'email',
  PHONE = 'phone',
  WEBAUTHN = 'webauthn'
}

/**
 * Base user profile information
 */
export interface UserProfile {
  name: string;
  email?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Complete user record including authentication and DID information
 */
export interface User extends UserProfile {
  id: string;
  did?: string;
  didDocument?: any; // Full DID document
  authMethods: AuthMethod[];
  webauthnCredentials?: WebAuthnCredential[];
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLogin?: Date;
}

/**
 * User data stored in JWT token
 */
export interface UserJwtPayload {
  id: string;
  did?: string;
  email?: string;
  phone?: string;
  name: string;
  authMethod: AuthMethod;
  iat?: number;
  exp?: number;
}

// ==================== OTP Types ====================

/**
 * OTP verification status
 */
export enum OtpStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  EXPIRED = 'expired',
  INVALID = 'invalid'
}

/**
 * OTP delivery method
 */
export enum OtpDeliveryMethod {
  EMAIL = 'email',
  SMS = 'sms'
}

/**
 * OTP record
 */
export interface OtpRecord {
  id: string;
  userId?: string;
  recipient: string; // email or phone
  code: string;
  method: OtpDeliveryMethod;
  status: OtpStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  expiresAt: Date;
  verifiedAt?: Date;
}

// ==================== WebAuthn Types ====================

/**
 * WebAuthn credential stored for a user
 */
export interface WebAuthnCredential {
  id: string;
  userId: string;
  credentialId: string; // base64url encoded credential ID
  publicKey: string; // base64url encoded public key
  counter: number; // signature counter
  transports?: string[]; // authenticator transports
  deviceType?: string; // platform or cross-platform
  createdAt: Date;
  lastUsed?: Date;
}

/**
 * WebAuthn registration options for client
 */
export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: {
    type: string;
    alg: number;
  }[];
  timeout?: number;
  excludeCredentials?: {
    id: string;
    type: string;
    transports?: string[];
  }[];
  authenticatorSelection?: {
    authenticatorAttachment?: string;
    requireResidentKey?: boolean;
    residentKey?: string;
    userVerification?: string;
  };
  attestation?: string;
}

/**
 * WebAuthn authentication options for client
 */
export interface WebAuthnAuthenticationOptions {
  challenge: string;
  rpId: string;
  allowCredentials: {
    id: string;
    type: string;
    transports?: string[];
  }[];
  userVerification?: string;
  timeout?: number;
}

// ==================== DID Types ====================

/**
 * DID method types supported
 */
export enum DIDMethod {
  KEY = 'key',
  HEDERA = 'hedera'
}

/**
 * DID creation options
 */
export interface DIDCreationOptions {
  method: DIDMethod;
  network?: string; // For Hedera: 'testnet', 'mainnet', etc.
  keyType?: 'ed25519' | 'secp256k1';
}

/**
 * DID key pair
 */
export interface DIDKeyPair {
  id: string;
  type: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: any;
  privateKeyMultibase?: string;
  privateKeyJwk?: any;
}

/**
 * Simplified DID document structure
 */
export interface DIDDocument {
  id: string;
  controller?: string[];
  verificationMethod?: any[];
  authentication?: any[];
  assertionMethod?: any[];
  keyAgreement?: any[];
  capabilityInvocation?: any[];
  capabilityDelegation?: any[];
  service?: any[];
}

// ==================== API Request/Response Types ====================

/**
 * Request to send OTP
 */
export interface RequestOtpRequest {
  email?: string;
  phone?: string;
  purpose: 'registration' | 'login' | 'recovery';
}

/**
 * Response after OTP request
 */
export interface RequestOtpResponse {
  success: boolean;
  message: string;
  otpId: string;
  expiresAt: Date;
  method: OtpDeliveryMethod;
}

/**
 * Request to verify OTP
 */
export interface VerifyOtpRequest {
  otpId: string;
  code: string;
  registerUser?: boolean;
  name?: string;
}

/**
 * Response after OTP verification
 */
export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    did?: string;
  };
  isNewUser?: boolean;
  supportsWebAuthn?: boolean;
}

/**
 * Request to register WebAuthn credential
 */
export interface WebAuthnRegisterRequest {
  userId: string;
  name?: string; // Optional credential name
}

/**
 * Response with WebAuthn registration options
 */
export interface WebAuthnRegisterResponse {
  options: WebAuthnRegistrationOptions;
  sessionId: string; // To track this registration attempt
}

/**
 * Request to verify WebAuthn registration
 */
export interface WebAuthnVerifyRegisterRequest {
  sessionId: string;
  credential: any; // Credential response from navigator.credentials.create()
}

/**
 * Response after WebAuthn registration verification
 */
export interface WebAuthnVerifyRegisterResponse {
  success: boolean;
  message: string;
  credentialId?: string;
}

/**
 * Request to start WebAuthn authentication
 */
export interface WebAuthnAuthenticateRequest {
  email?: string;
  phone?: string;
}

/**
 * Response with WebAuthn authentication options
 */
export interface WebAuthnAuthenticateResponse {
  options: WebAuthnAuthenticationOptions;
  sessionId: string; // To track this authentication attempt
}

/**
 * Request to verify WebAuthn authentication
 */
export interface WebAuthnVerifyAuthenticateRequest {
  sessionId: string;
  credential: any; // Credential response from navigator.credentials.get()
}

/**
 * Response after WebAuthn authentication verification
 */
export interface WebAuthnVerifyAuthenticateResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    did?: string;
  };
}

// ==================== Error Types ====================

/**
 * API error response
 */
export interface ApiError {
  error: string;
  message: string;
  status: number;
  details?: any;
}

// ==================== Verifiable Credential Types ====================

/**
 * Basic verifiable credential structure
 */
export interface VerifiableCredential {
  '@context': string[];
  type: string[];
  id?: string;
  issuer: string | { id: string; [key: string]: any };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id?: string;
    [key: string]: any;
  };
  proof?: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    jws?: string;
    [key: string]: any;
  };
}

/**
 * Verifiable presentation structure
 */
export interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  id?: string;
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof?: {
    type: string;
    created: string;
    challenge?: string;
    domain?: string;
    proofPurpose: string;
    verificationMethod: string;
    jws?: string;
    [key: string]: any;
  };
}
