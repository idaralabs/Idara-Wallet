import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuthMethod, DIDMethod, DIDCreationOptions } from '../types';
import userModel from '../models/user';
import authUtils from '../utils/auth';
import didUtils from '../utils/did';

const router = express.Router();

/**
 * Get user profile
 * GET /api/user/profile
 */
router.get('/profile', authUtils.authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user from database
    const user = await userModel.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Return sanitized user profile (no sensitive data)
    return res.status(200).json({
      success: true,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        did: user.did,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        authMethods: user.authMethods,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error: any) {
    console.error('Error getting user profile:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user profile'
    });
  }
});

/**
 * Update user profile
 * PUT /api/user/profile
 */
router.put('/profile', [
  body('name')
    .optional()
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required')
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
    const userId = (req as any).user.id;
    const { name, email } = req.body;
    
    // Ensure at least one field is provided
    if (!name && !email) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'At least one field to update is required'
      });
    }
    
    // Check if email already exists
    if (email) {
      const existingUser = await userModel.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Email already in use by another account'
        });
      }
    }
    
    // Update user
    const updatedUser = await userModel.updateUser(userId, {
      ...(name && { name }),
      ...(email && { email }),
      updatedAt: new Date()
    });
    
    if (!updatedUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Return updated profile
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        did: updatedUser.did,
        isEmailVerified: updatedUser.isEmailVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
        authMethods: updatedUser.authMethods,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user profile'
    });
  }
});

/**
 * Get user's DID information
 * GET /api/user/did
 */
router.get('/did', authUtils.authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user from database
    const user = await userModel.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Check if user has a DID
    if (!user.did) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No DID found for this user'
      });
    }
    
    // Resolve DID to get the DID document
    let didDocument = user.didDocument;
    
    // If DID document is not stored, resolve it
    if (!didDocument) {
      try {
        didDocument = await didUtils.resolveDID(user.did);
      } catch (error) {
        console.error('Error resolving DID:', error);
        return res.status(500).json({
          error: 'DID Resolution Error',
          message: 'Failed to resolve DID document'
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      did: user.did,
      didDocument
    });
  } catch (error: any) {
    console.error('Error getting DID information:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get DID information'
    });
  }
});

/**
 * Generate a new DID for the user
 * POST /api/user/did/generate
 */
router.post('/did/generate', [
  body('method')
    .optional()
    .isIn([DIDMethod.KEY, DIDMethod.HEDERA])
    .withMessage('Invalid DID method'),
  body('network')
    .optional()
    .isIn(['testnet', 'mainnet', 'previewnet'])
    .withMessage('Invalid network'),
  body('keyType')
    .optional()
    .isIn(['ed25519', 'secp256k1'])
    .withMessage('Invalid key type')
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
    const userId = (req as any).user.id;
    const { method, network, keyType } = req.body;
    
    // Get user from database
    const user = await userModel.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Check if user already has a DID
    if (user.did) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User already has a DID. To create a new one, please delete the existing DID first.'
      });
    }
    
    // Generate DID
    const options: DIDCreationOptions = {
      method: method || DIDMethod.KEY,
      ...(network && { network }),
      ...(keyType && { keyType })
    };
    
    try {
      const { did, didDocument, keyPair } = await didUtils.generateDID(options);
      
      // Update user with new DID
      await userModel.setUserDid(userId, did, didDocument);
      
      // Return DID information (excluding private key)
      return res.status(200).json({
        success: true,
        message: 'DID generated successfully',
        did,
        didDocument,
        publicKey: {
          id: keyPair.id,
          type: keyPair.type,
          publicKeyMultibase: keyPair.publicKeyMultibase,
          publicKeyJwk: keyPair.publicKeyJwk
        }
      });
    } catch (error: any) {
      console.error('Error generating DID:', error);
      return res.status(500).json({
        error: 'DID Generation Error',
        message: error.message || 'Failed to generate DID'
      });
    }
  } catch (error: any) {
    console.error('Error in DID generation endpoint:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process DID generation request'
    });
  }
});

/**
 * Validate a DID
 * POST /api/user/did/validate
 */
router.post('/did/validate', [
  body('did')
    .notEmpty()
    .withMessage('DID is required')
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
    const { did } = req.body;
    
    // Validate DID format
    const isValid = didUtils.isValidDID(did);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid DID format',
        isValid: false
      });
    }
    
    // Try to resolve DID
    try {
      const didDocument = await didUtils.resolveDID(did);
      
      return res.status(200).json({
        success: true,
        message: 'DID is valid',
        isValid: true,
        didDocument
      });
    } catch (error) {
      return res.status(200).json({
        success: true,
        message: 'DID format is valid but could not be resolved',
        isValid: true,
        resolvable: false
      });
    }
  } catch (error: any) {
    console.error('Error validating DID:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate DID'
    });
  }
});

/**
 * Delete user account
 * DELETE /api/user/account
 */
router.delete('/account', authUtils.authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Delete user
    const deleted = await userModel.deleteUser(userId);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting user account:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete account'
    });
  }
});

/**
 * Check if email is available
 * GET /api/user/check-email/:email
 */
router.get('/check-email/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    
    // Check if email is valid
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid email format'
      });
    }
    
    // Check if email exists
    const user = await userModel.getUserByEmail(email);
    
    return res.status(200).json({
      success: true,
      available: !user
    });
  } catch (error: any) {
    console.error('Error checking email availability:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check email availability'
    });
  }
});

/**
 * Check if phone is available
 * GET /api/user/check-phone/:phone
 */
router.get('/check-phone/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    
    // Check if phone is valid (E.164 format)
    if (!phone || !phone.match(/^\+[1-9]\d{1,14}$/)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid phone format. Use E.164 format (e.g., +12125551234)'
      });
    }
    
    // Check if phone exists
    const user = await userModel.getUserByPhone(phone);
    
    return res.status(200).json({
      success: true,
      available: !user
    });
  } catch (error: any) {
    console.error('Error checking phone availability:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check phone availability'
    });
  }
});

export default router;
