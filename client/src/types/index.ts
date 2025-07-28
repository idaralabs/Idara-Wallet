/**
 * Core type definitions for the Hedera ID Wallet MVP - Client Side
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
 * User profile information
 */
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  did?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  authMethods?: AuthMethod[];
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
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

// ==================== Authentication Types ====================

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
 * WebAuthn credential information
 */
export interface WebAuthnCredential {
  id: string;
  credentialId: string;
  deviceType?: string;
  createdAt: string;
  lastUsed?: string;
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
 * DID document structure (simplified for client)
 */
export interface DIDDocument {
  id: string;
  controller?: string[];
  verificationMethod?: any[];
  authentication?: any[];
  assertionMethod?: any[];
  service?: any[];
}

/**
 * DID key pair (for client-side key generation)
 */
export interface DIDKeyPair {
  id: string;
  type: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: any;
  privateKeyMultibase?: string;
  privateKeyJwk?: any;
}

// ==================== Verifiable Credential Types ====================

/**
 * Credential status
 */
export enum CredentialStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  PENDING = 'pending'
}

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
  status?: CredentialStatus;
  metadata?: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    issuerName?: string;
    issuerLogo?: string;
    importedAt?: string;
    lastUsed?: string;
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
  expiresAt: string;
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
  name?: string;
}

/**
 * Response with WebAuthn registration options
 */
export interface WebAuthnRegisterResponse {
  sessionId: string;
  options: any; // PublicKeyCredentialCreationOptions from @simplewebauthn/browser
}

/**
 * Request to verify WebAuthn registration
 */
export interface WebAuthnVerifyRegisterRequest {
  sessionId: string;
  credential: any; // From navigator.credentials.create()
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
  sessionId: string;
  options: any; // PublicKeyCredentialRequestOptions from @simplewebauthn/browser
}

/**
 * Request to verify WebAuthn authentication
 */
export interface WebAuthnVerifyAuthenticateRequest {
  sessionId: string;
  credential: any; // From navigator.credentials.get()
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

// ==================== UI Types ====================

/**
 * Authentication state for the auth context
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  token: string | null;
}

/**
 * Navigation item for the sidebar
 */
export interface NavItem {
  name: string;
  path: string;
  icon?: React.ComponentType<any>;
  badge?: {
    text: string;
    color: string;
  };
}

/**
 * Modal props for reusable modal component
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Toast notification types
 */
export interface ToastOptions {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

/**
 * Credential display options
 */
export interface CredentialDisplayOptions {
  showIssuer: boolean;
  showExpiry: boolean;
  showQR: boolean;
  compact?: boolean;
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  message: string;
  status?: number;
  details?: any;
}

// ==================== Storage Types ====================

/**
 * Stored credential with metadata
 */
export interface StoredCredential extends VerifiableCredential {
  localId: string; // Local database ID
  imported: string; // Date imported
  lastUsed?: string; // Date last used
  favorite?: boolean; // User marked as favorite
  tags?: string[]; // User-defined tags
  encrypted?: boolean; // Whether the credential is encrypted
}

/**
 * Local storage keys
 */
export enum StorageKeys {
  AUTH_TOKEN = 'auth_token',
  USER_PROFILE = 'user_profile',
  THEME = 'theme',
  ONBOARDING_COMPLETE = 'onboarding_complete',
  BIOMETRIC_ENABLED = 'biometric_enabled'
}

/**
 * Database schema
 */
export interface DatabaseSchema {
  credentials: StoredCredential;
  keys: DIDKeyPair;
  settings: {
    key: string;
    value: any;
  };
}
