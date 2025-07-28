import { v4 as uuidv4 } from 'uuid';
import { 
  User, 
  UserProfile, 
  AuthMethod, 
  OtpRecord, 
  OtpStatus, 
  OtpDeliveryMethod,
  WebAuthnCredential,
  DIDMethod,
  DIDDocument
} from '../types';

/**
 * In-memory storage for the MVP
 * In a production environment, this would be replaced with a database
 */
class UserModel {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> userId
  private phoneIndex: Map<string, string> = new Map(); // phone -> userId
  private didIndex: Map<string, string> = new Map();   // did -> userId
  private otpRecords: Map<string, OtpRecord> = new Map();
  private webauthnCredentials: Map<string, WebAuthnCredential> = new Map();
  private webauthnCredentialsByUser: Map<string, Set<string>> = new Map(); // userId -> Set<credentialId>

  /**
   * Create a new user
   */
  async createUser(profile: UserProfile, authMethod: AuthMethod): Promise<User> {
    // Validate input
    if (!profile.name) {
      throw new Error('Name is required');
    }
    
    if (!profile.email && !profile.phone) {
      throw new Error('Either email or phone is required');
    }
    
    // Check if user with this email or phone already exists
    if (profile.email && this.emailIndex.has(profile.email.toLowerCase())) {
      throw new Error('User with this email already exists');
    }
    
    if (profile.phone && this.phoneIndex.has(profile.phone)) {
      throw new Error('User with this phone already exists');
    }
    
    // Create new user
    const userId = uuidv4();
    const now = new Date();
    
    const user: User = {
      id: userId,
      ...profile,
      authMethods: [authMethod],
      isEmailVerified: false,
      isPhoneVerified: false,
      createdAt: now,
      updatedAt: now
    };
    
    // Store user
    this.users.set(userId, user);
    
    // Update indexes
    if (profile.email) {
      this.emailIndex.set(profile.email.toLowerCase(), userId);
    }
    
    if (profile.phone) {
      this.phoneIndex.set(profile.phone, userId);
    }
    
    return user;
  }
  
  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user || null;
  }
  
  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email.toLowerCase());
    if (!userId) return null;
    
    return this.users.get(userId) || null;
  }
  
  /**
   * Get user by phone
   */
  async getUserByPhone(phone: string): Promise<User | null> {
    const userId = this.phoneIndex.get(phone);
    if (!userId) return null;
    
    return this.users.get(userId) || null;
  }
  
  /**
   * Get user by DID
   */
  async getUserByDid(did: string): Promise<User | null> {
    const userId = this.didIndex.get(did);
    if (!userId) return null;
    
    return this.users.get(userId) || null;
  }
  
  /**
   * Update user information
   */
  async updateUser(id: string, updates: Partial<UserProfile>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    
    // Handle email update (update index)
    if (updates.email && updates.email !== user.email) {
      // Remove old email from index
      if (user.email) {
        this.emailIndex.delete(user.email.toLowerCase());
      }
      
      // Check if new email already exists
      if (this.emailIndex.has(updates.email.toLowerCase())) {
        throw new Error('Email already in use');
      }
      
      // Add new email to index
      this.emailIndex.set(updates.email.toLowerCase(), id);
    }
    
    // Handle phone update (update index)
    if (updates.phone && updates.phone !== user.phone) {
      // Remove old phone from index
      if (user.phone) {
        this.phoneIndex.delete(user.phone);
      }
      
      // Check if new phone already exists
      if (this.phoneIndex.has(updates.phone)) {
        throw new Error('Phone already in use');
      }
      
      // Add new phone to index
      this.phoneIndex.set(updates.phone, id);
    }
    
    // Update user
    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    
    return updatedUser;
  }
  
  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    
    // Remove from indexes
    if (user.email) {
      this.emailIndex.delete(user.email.toLowerCase());
    }
    
    if (user.phone) {
      this.phoneIndex.delete(user.phone);
    }
    
    if (user.did) {
      this.didIndex.delete(user.did);
    }
    
    // Remove user's WebAuthn credentials
    const credentialIds = this.webauthnCredentialsByUser.get(id);
    if (credentialIds) {
      credentialIds.forEach(credId => {
        this.webauthnCredentials.delete(credId);
      });
      this.webauthnCredentialsByUser.delete(id);
    }
    
    // Remove user
    this.users.delete(id);
    
    return true;
  }
  
  /**
   * Set user's DID
   */
  async setUserDid(userId: string, did: string, didDocument?: DIDDocument): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    
    // Check if DID already assigned to another user
    const existingUserId = this.didIndex.get(did);
    if (existingUserId && existingUserId !== userId) {
      throw new Error('DID already assigned to another user');
    }
    
    // Update user
    const updatedUser: User = {
      ...user,
      did,
      didDocument,
      updatedAt: new Date()
    };
    
    this.users.set(userId, updatedUser);
    this.didIndex.set(did, userId);
    
    return updatedUser;
  }
  
  /**
   * Mark email as verified
   */
  async verifyEmail(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    
    const updatedUser: User = {
      ...user,
      isEmailVerified: true,
      updatedAt: new Date()
    };
    
    this.users.set(userId, updatedUser);
    
    return updatedUser;
  }
  
  /**
   * Mark phone as verified
   */
  async verifyPhone(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    
    const updatedUser: User = {
      ...user,
      isPhoneVerified: true,
      updatedAt: new Date()
    };
    
    this.users.set(userId, updatedUser);
    
    return updatedUser;
  }
  
  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    
    const updatedUser: User = {
      ...user,
      lastLogin: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(userId, updatedUser);
    
    return updatedUser;
  }
  
  /**
   * Add authentication method to user
   */
  async addAuthMethod(userId: string, method: AuthMethod): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    
    if (user.authMethods.includes(method)) {
      return user; // Method already exists
    }
    
    const updatedUser: User = {
      ...user,
      authMethods: [...user.authMethods, method],
      updatedAt: new Date()
    };
    
    this.users.set(userId, updatedUser);
    
    return updatedUser;
  }
  
  // ==================== OTP Methods ====================
  
  /**
   * Create a new OTP record
   */
  async createOtp(
    recipient: string, 
    method: OtpDeliveryMethod, 
    code: string, 
    userId?: string
  ): Promise<OtpRecord> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes expiry
    
    const otp: OtpRecord = {
      id: uuidv4(),
      userId,
      recipient,
      code,
      method,
      status: OtpStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      expiresAt
    };
    
    this.otpRecords.set(otp.id, otp);
    
    return otp;
  }
  
  /**
   * Get OTP record by ID
   */
  async getOtpById(id: string): Promise<OtpRecord | null> {
    const otp = this.otpRecords.get(id);
    return otp || null;
  }
  
  /**
   * Verify OTP code
   */
  async verifyOtp(id: string, code: string): Promise<OtpRecord | null> {
    const otp = this.otpRecords.get(id);
    if (!otp) return null;
    
    // Check if OTP is expired
    if (new Date() > otp.expiresAt) {
      const expiredOtp: OtpRecord = {
        ...otp,
        status: OtpStatus.EXPIRED
      };
      this.otpRecords.set(id, expiredOtp);
      return expiredOtp;
    }
    
    // Check if max attempts reached
    if (otp.attempts >= otp.maxAttempts) {
      return otp;
    }
    
    // Increment attempts
    const updatedOtp: OtpRecord = {
      ...otp,
      attempts: otp.attempts + 1
    };
    
    // Check if code matches
    if (code === otp.code) {
      updatedOtp.status = OtpStatus.VERIFIED;
      updatedOtp.verifiedAt = new Date();
    } else {
      updatedOtp.status = OtpStatus.INVALID;
    }
    
    this.otpRecords.set(id, updatedOtp);
    
    return updatedOtp;
  }
  
  /**
   * Invalidate all pending OTPs for a recipient
   */
  async invalidateOtps(recipient: string): Promise<void> {
    this.otpRecords.forEach((otp, id) => {
      if (otp.recipient === recipient && otp.status === OtpStatus.PENDING) {
        this.otpRecords.set(id, {
          ...otp,
          status: OtpStatus.INVALID
        });
      }
    });
  }
  
  // ==================== WebAuthn Methods ====================
  
  /**
   * Store WebAuthn credential
   */
  async storeWebAuthnCredential(credential: Omit<WebAuthnCredential, 'id'>): Promise<WebAuthnCredential> {
    const id = uuidv4();
    const now = new Date();
    
    const webauthnCredential: WebAuthnCredential = {
      id,
      ...credential,
      createdAt: now
    };
    
    // Store credential
    this.webauthnCredentials.set(id, webauthnCredential);
    
    // Update user's credentials index
    let userCredentials = this.webauthnCredentialsByUser.get(credential.userId);
    if (!userCredentials) {
      userCredentials = new Set<string>();
      this.webauthnCredentialsByUser.set(credential.userId, userCredentials);
    }
    userCredentials.add(id);
    
    // Add WebAuthn as auth method for user
    await this.addAuthMethod(credential.userId, AuthMethod.WEBAUTHN);
    
    return webauthnCredential;
  }
  
  /**
   * Get WebAuthn credential by ID
   */
  async getWebAuthnCredentialById(id: string): Promise<WebAuthnCredential | null> {
    const credential = this.webauthnCredentials.get(id);
    return credential || null;
  }
  
  /**
   * Get WebAuthn credential by credential ID
   */
  async getWebAuthnCredentialByCredentialId(credentialId: string): Promise<WebAuthnCredential | null> {
    for (const credential of this.webauthnCredentials.values()) {
      if (credential.credentialId === credentialId) {
        return credential;
      }
    }
    return null;
  }
  
  /**
   * Get all WebAuthn credentials for a user
   */
  async getWebAuthnCredentialsByUserId(userId: string): Promise<WebAuthnCredential[]> {
    const credentialIds = this.webauthnCredentialsByUser.get(userId);
    if (!credentialIds) return [];
    
    const credentials: WebAuthnCredential[] = [];
    credentialIds.forEach(id => {
      const credential = this.webauthnCredentials.get(id);
      if (credential) {
        credentials.push(credential);
      }
    });
    
    return credentials;
  }
  
  /**
   * Update WebAuthn credential counter
   */
  async updateWebAuthnCredentialCounter(id: string, counter: number): Promise<WebAuthnCredential | null> {
    const credential = this.webauthnCredentials.get(id);
    if (!credential) return null;
    
    const updatedCredential: WebAuthnCredential = {
      ...credential,
      counter,
      lastUsed: new Date()
    };
    
    this.webauthnCredentials.set(id, updatedCredential);
    
    return updatedCredential;
  }
  
  /**
   * Delete WebAuthn credential
   */
  async deleteWebAuthnCredential(id: string): Promise<boolean> {
    const credential = this.webauthnCredentials.get(id);
    if (!credential) return false;
    
    // Remove from user's credentials
    const userCredentials = this.webauthnCredentialsByUser.get(credential.userId);
    if (userCredentials) {
      userCredentials.delete(id);
      
      // If this was the last WebAuthn credential, remove WebAuthn from auth methods
      if (userCredentials.size === 0) {
        const user = this.users.get(credential.userId);
        if (user) {
          const updatedUser: User = {
            ...user,
            authMethods: user.authMethods.filter(method => method !== AuthMethod.WEBAUTHN),
            updatedAt: new Date()
          };
          this.users.set(credential.userId, updatedUser);
        }
      }
    }
    
    // Remove credential
    this.webauthnCredentials.delete(id);
    
    return true;
  }
  
  /**
   * Get all users (for admin purposes)
   */
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  /**
   * Clear all data (for testing purposes)
   */
  async clearAll(): Promise<void> {
    this.users.clear();
    this.emailIndex.clear();
    this.phoneIndex.clear();
    this.didIndex.clear();
    this.otpRecords.clear();
    this.webauthnCredentials.clear();
    this.webauthnCredentialsByUser.clear();
  }
}

// Export singleton instance
export default new UserModel();
