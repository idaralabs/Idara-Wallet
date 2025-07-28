import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import { 
  AuthMethod, 
  WebAuthnAuthenticateRequest, 
  WebAuthnRegisterRequest 
} from '../types';
import userModel from '../models/user';
import authUtils from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// WebAuthn session storage (in-memory for MVP)
// In production, use Redis or another distributed cache
interface WebAuthnSession {
  challenge: string;
  userId?: string;
  email?: string;
  phone?: string;
  expires: Date;
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

const webAuthnSessions = new Map<string, WebAuthnSession>();

// Get WebAuthn configuration from environment variables
const RP_ID = process.env.RP_ID || 'localhost';
const RP_NAME = process.env.RP_NAME || 'Hedera ID Wallet';
const RP_ORIGIN = process.env.RP_ORIGIN || 'http://localhost:5173';

// Clean up expired sessions periodically
setInterval(() => {
  const now = new Date();
  webAuthnSessions.forEach((session, id) => {
    if (session.expires < now) {
      webAuthnSessions.delete(id);
    }
  });
}, 15 * 60 * 1000); // Clean up every 15 minutes

/**
 * Start WebAuthn registration process
 * POST /api/webauthn/register
 */
router.post('/register', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('name').optional().isString().withMessage('Name must be a string')
], authUtils.authenticate, async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array()
    });
  }

  try {
    const { userId, name } = req.body as WebAuthnRegisterRequest;
    
    // Verify that the authenticated user is registering their own device
    const authenticatedUserId = (req as any).user.id;
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only register WebAuthn credentials for your own account'
      });
    }

    // Get user from database
    const user = await userModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Get existing credentials for exclusion
    const existingCredentials = await userModel.getWebAuthnCredentialsByUserId(userId);
    const excludeCredentials = existingCredentials.map(cred => ({
      id: isoBase64URL.toBuffer(cred.credentialId),
      type: 'public-key',
      transports: cred.transports
    }));

    // Generate registration options
    const options: GenerateRegistrationOptionsOpts = {
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userId,
      userName: user.email || user.phone || user.name,
      userDisplayName: user.name,
      timeout: 60000, // 1 minute
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform' // Prefer platform authenticators (TouchID, FaceID, Windows Hello)
      }
    };

    const registrationOptions = generateRegistrationOptions(options);

    // Store challenge in session
    const sessionId = uuidv4();
    const session: WebAuthnSession = {
      challenge: registrationOptions.challenge,
      userId,
      expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
      userVerification: 'preferred'
    };
    webAuthnSessions.set(sessionId, session);

    return res.status(200).json({
      sessionId,
      options: registrationOptions
    });
  } catch (error: any) {
    console.error('Error generating WebAuthn registration options:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate registration options'
    });
  }
});

/**
 * Verify WebAuthn registration
 * POST /api/webauthn/verify-registration
 */
router.post('/verify-registration', [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('credential').notEmpty().withMessage('Credential is required')
], async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array()
    });
  }

  try {
    const { sessionId, credential } = req.body;

    // Get session
    const session = webAuthnSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({
        error: 'Invalid Session',
        message: 'Registration session not found or expired'
      });
    }

    // Get user
    const user = await userModel.getUserById(session.userId!);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Verify registration response
    const expectedChallenge = session.challenge;
    const expectedOrigin = RP_ORIGIN;
    const expectedRPID = RP_ID;

    const verifyOptions: VerifyRegistrationResponseOpts = {
      response: credential,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: session.userVerification === 'required'
    };

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse(verifyOptions);
    } catch (error: any) {
      console.error('Error verifying registration:', error);
      return res.status(400).json({
        error: 'Verification Error',
        message: error.message || 'Failed to verify registration'
      });
    }

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      return res.status(400).json({
        error: 'Verification Error',
        message: 'Registration verification failed'
      });
    }

    // Get credential info
    const { credentialID, credentialPublicKey, counter } = registrationInfo;

    // Store credential in database
    const credentialRecord = await userModel.storeWebAuthnCredential({
      userId: session.userId!,
      credentialId: isoBase64URL.fromBuffer(credentialID),
      publicKey: isoBase64URL.fromBuffer(credentialPublicKey),
      counter,
      transports: credential.response.transports || [],
      deviceType: 'platform' // Assuming platform authenticator
    });

    // Clean up session
    webAuthnSessions.delete(sessionId);

    // Add WebAuthn as an auth method for user
    await userModel.addAuthMethod(session.userId!, AuthMethod.WEBAUTHN);

    return res.status(200).json({
      success: true,
      message: 'WebAuthn credential registered successfully',
      credentialId: credentialRecord.credentialId
    });
  } catch (error: any) {
    console.error('Error verifying WebAuthn registration:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify registration'
    });
  }
});

/**
 * Start WebAuthn authentication process
 * POST /api/webauthn/authenticate
 */
router.post('/authenticate', [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().withMessage('Valid phone number is required')
], async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array()
    });
  }

  try {
    const { email, phone } = req.body as WebAuthnAuthenticateRequest;

    // Ensure either email or phone is provided
    if (!email && !phone) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Either email or phone is required'
      });
    }

    // Get user by email or phone
    let user;
    if (email) {
      user = await userModel.getUserByEmail(email);
    } else {
      user = await userModel.getUserByPhone(phone!);
    }

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No account found with this ${email ? 'email' : 'phone number'}`
      });
    }

    // Check if user has WebAuthn credentials
    const credentials = await userModel.getWebAuthnCredentialsByUserId(user.id);
    if (!credentials || credentials.length === 0) {
      return res.status(400).json({
        error: 'Authentication Error',
        message: 'No WebAuthn credentials found for this user',
        fallbackToOtp: true
      });
    }

    // Generate authentication options
    const options: GenerateAuthenticationOptionsOpts = {
      rpID: RP_ID,
      timeout: 60000, // 1 minute
      userVerification: 'preferred',
      allowCredentials: credentials.map(cred => ({
        id: isoBase64URL.toBuffer(cred.credentialId),
        type: 'public-key',
        transports: cred.transports
      }))
    };

    const authenticationOptions = generateAuthenticationOptions(options);

    // Store challenge in session
    const sessionId = uuidv4();
    const session: WebAuthnSession = {
      challenge: authenticationOptions.challenge,
      userId: user.id,
      email: user.email,
      phone: user.phone,
      expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
      userVerification: 'preferred'
    };
    webAuthnSessions.set(sessionId, session);

    return res.status(200).json({
      sessionId,
      options: authenticationOptions
    });
  } catch (error: any) {
    console.error('Error generating WebAuthn authentication options:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate authentication options'
    });
  }
});

/**
 * Verify WebAuthn authentication
 * POST /api/webauthn/verify-authentication
 */
router.post('/verify-authentication', [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('credential').notEmpty().withMessage('Credential is required')
], async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array()
    });
  }

  try {
    const { sessionId, credential } = req.body;

    // Get session
    const session = webAuthnSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({
        error: 'Invalid Session',
        message: 'Authentication session not found or expired'
      });
    }

    // Get user
    const user = await userModel.getUserById(session.userId!);
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Get credential ID from the response
    const credentialId = isoBase64URL.fromBuffer(credential.id);

    // Find the credential in the database
    const storedCredential = await userModel.getWebAuthnCredentialByCredentialId(credentialId);
    if (!storedCredential) {
      return res.status(400).json({
        error: 'Authentication Error',
        message: 'Unknown credential',
        fallbackToOtp: true
      });
    }

    // Verify that the credential belongs to the user
    if (storedCredential.userId !== user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Credential does not belong to this user'
      });
    }

    // Verify authentication response
    const expectedChallenge = session.challenge;
    const expectedOrigin = RP_ORIGIN;
    const expectedRPID = RP_ID;

    const verifyOptions: VerifyAuthenticationResponseOpts = {
      response: credential,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: session.userVerification === 'required',
      authenticator: {
        credentialID: isoBase64URL.toBuffer(storedCredential.credentialId),
        credentialPublicKey: isoBase64URL.toBuffer(storedCredential.publicKey),
        counter: storedCredential.counter
      }
    };

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse(verifyOptions);
    } catch (error: any) {
      console.error('Error verifying authentication:', error);
      return res.status(400).json({
        error: 'Verification Error',
        message: error.message || 'Failed to verify authentication',
        fallbackToOtp: true
      });
    }

    const { verified, authenticationInfo } = verification;

    if (!verified || !authenticationInfo) {
      return res.status(400).json({
        error: 'Verification Error',
        message: 'Authentication verification failed',
        fallbackToOtp: true
      });
    }

    // Update credential counter
    await userModel.updateWebAuthnCredentialCounter(
      storedCredential.id,
      authenticationInfo.newCounter
    );

    // Update last login timestamp
    await userModel.updateLastLogin(user.id);

    // Generate JWT token
    const token = authUtils.generateToken(user, AuthMethod.WEBAUTHN);

    // Clean up session
    webAuthnSessions.delete(sessionId);

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        did: user.did
      }
    });
  } catch (error: any) {
    console.error('Error verifying WebAuthn authentication:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify authentication'
    });
  }
});

/**
 * Get registered WebAuthn credentials for a user
 * GET /api/webauthn/credentials
 */
router.get('/credentials', authUtils.authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get credentials
    const credentials = await userModel.getWebAuthnCredentialsByUserId(userId);

    // Return sanitized credential info (no private keys)
    const sanitizedCredentials = credentials.map(cred => ({
      id: cred.id,
      credentialId: cred.credentialId,
      deviceType: cred.deviceType,
      createdAt: cred.createdAt,
      lastUsed: cred.lastUsed
    }));

    return res.status(200).json({
      success: true,
      credentials: sanitizedCredentials
    });
  } catch (error: any) {
    console.error('Error getting WebAuthn credentials:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get credentials'
    });
  }
});

/**
 * Delete a WebAuthn credential
 * DELETE /api/webauthn/credentials/:id
 */
router.delete('/credentials/:id', authUtils.authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const credentialId = req.params.id;

    // Get credential
    const credential = await userModel.getWebAuthnCredentialById(credentialId);
    if (!credential) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Credential not found'
      });
    }

    // Verify that the credential belongs to the user
    if (credential.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own credentials'
      });
    }

    // Delete credential
    await userModel.deleteWebAuthnCredential(credentialId);

    return res.status(200).json({
      success: true,
      message: 'Credential deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting WebAuthn credential:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete credential'
    });
  }
});

export default router;
