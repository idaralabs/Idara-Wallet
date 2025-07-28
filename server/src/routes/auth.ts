import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { 
  AuthMethod, 
  OtpDeliveryMethod, 
  OtpStatus,
  RequestOtpRequest,
  VerifyOtpRequest
} from '../types';
import userModel from '../models/user';
import otpUtils from '../utils/otp';
import authUtils from '../utils/auth';
import didUtils from '../utils/did';

const router = express.Router();

/**
 * Request OTP for authentication or registration
 * POST /api/auth/request-otp
 */
router.post('/request-otp', [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required when using email authentication'),
  body('phone')
    .optional()
    .custom(value => otpUtils.isValidPhone(value))
    .withMessage('Valid phone number in E.164 format is required (e.g., +12125551234)'),
  body('purpose')
    .isIn(['registration', 'login', 'recovery'])
    .withMessage('Purpose must be registration, login, or recovery')
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

  const { email, phone, purpose } = req.body as RequestOtpRequest;

  try {
    // Ensure either email or phone is provided
    if (!email && !phone) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Either email or phone is required'
      });
    }

    // Check if both email and phone are provided
    if (email && phone) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Provide either email or phone, not both'
      });
    }

    // Determine delivery method and recipient
    const method = email ? OtpDeliveryMethod.EMAIL : OtpDeliveryMethod.SMS;
    const recipient = email || phone;

    // For login, check if user exists
    if (purpose === 'login') {
      const user = email 
        ? await userModel.getUserByEmail(email)
        : await userModel.getUserByPhone(phone!);

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: `No account found with this ${email ? 'email' : 'phone number'}. Please register first.`
        });
      }

      // Create and send OTP
      const otpRecord = await otpUtils.createAndSendOtp(recipient!, method, purpose, user.id);

      return res.status(200).json({
        success: true,
        message: `OTP sent to ${method === OtpDeliveryMethod.EMAIL ? 'email' : 'phone'}`,
        otpId: otpRecord!.id,
        expiresAt: otpRecord!.expiresAt,
        method
      });
    }

    // For registration, check if user already exists
    if (purpose === 'registration') {
      const existingUser = email 
        ? await userModel.getUserByEmail(email)
        : await userModel.getUserByPhone(phone!);

      if (existingUser) {
        return res.status(409).json({
          error: 'Conflict',
          message: `Account with this ${email ? 'email' : 'phone number'} already exists. Please login instead.`
        });
      }
    }

    // Create and send OTP
    const otpRecord = await otpUtils.createAndSendOtp(recipient!, method, purpose);

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${method === OtpDeliveryMethod.EMAIL ? 'email' : 'phone'}`,
      otpId: otpRecord!.id,
      expiresAt: otpRecord!.expiresAt,
      method
    });
  } catch (error: any) {
    console.error('Error requesting OTP:', error);
    
    if (error.message === 'Rate limit exceeded. Please try again later.') {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: error.message
      });
    }
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to send OTP. Please try again later.'
    });
  }
});

/**
 * Verify OTP and authenticate or register user
 * POST /api/auth/verify-otp
 */
router.post('/verify-otp', [
  body('otpId')
    .notEmpty()
    .withMessage('OTP ID is required'),
  body('code')
    .notEmpty()
    .withMessage('OTP code is required'),
  body('registerUser')
    .optional()
    .isBoolean()
    .withMessage('registerUser must be a boolean'),
  body('name')
    .optional()
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
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

  const { otpId, code, registerUser, name } = req.body as VerifyOtpRequest;

  try {
    // Verify OTP
    const otpRecord = await otpUtils.verifyOtp(otpId, code);

    if (!otpRecord) {
      return res.status(400).json({
        error: 'Verification Error',
        message: 'Invalid OTP ID'
      });
    }

    // Check OTP status
    if (otpRecord.status === OtpStatus.EXPIRED) {
      return res.status(400).json({
        error: 'Verification Error',
        message: 'OTP has expired. Please request a new one.'
      });
    }

    if (otpRecord.status !== OtpStatus.VERIFIED) {
      return res.status(400).json({
        error: 'Verification Error',
        message: 'Invalid OTP code',
        attemptsLeft: otpRecord.maxAttempts - otpRecord.attempts
      });
    }

    // Determine auth method based on OTP delivery method
    const authMethod = otpRecord.method === OtpDeliveryMethod.EMAIL 
      ? AuthMethod.EMAIL 
      : AuthMethod.PHONE;

    let user;
    let isNewUser = false;

    // If OTP is linked to a user, get the user
    if (otpRecord.userId) {
      user = await userModel.getUserById(otpRecord.userId);
      
      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }
    } else {
      // No user ID in OTP record, check if user exists by recipient
      if (otpRecord.method === OtpDeliveryMethod.EMAIL) {
        user = await userModel.getUserByEmail(otpRecord.recipient);
      } else {
        user = await userModel.getUserByPhone(otpRecord.recipient);
      }

      // If user doesn't exist and registerUser is true, create new user
      if (!user && registerUser) {
        if (!name) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Name is required for registration'
          });
        }

        // Create user profile
        const userProfile = {
          name,
          ...(otpRecord.method === OtpDeliveryMethod.EMAIL 
            ? { email: otpRecord.recipient } 
            : { phone: otpRecord.recipient }),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Create user
        user = await userModel.createUser(userProfile, authMethod);
        isNewUser = true;

        // Mark email/phone as verified
        if (otpRecord.method === OtpDeliveryMethod.EMAIL) {
          await userModel.verifyEmail(user.id);
        } else {
          await userModel.verifyPhone(user.id);
        }

        // Generate DID for new user
        try {
          const { did, didDocument, keyPair } = await didUtils.generateDID();
          await userModel.setUserDid(user.id, did, didDocument);
          
          // Note: In a production app, we would securely store the keyPair
          // For MVP, we'll assume the client generates and manages keys
          console.log(`Generated DID for user ${user.id}: ${did}`);
        } catch (error) {
          console.error('Error generating DID:', error);
          // Continue even if DID generation fails
        }
      } else if (!user && !registerUser) {
        return res.status(404).json({
          error: 'Not Found',
          message: `No account found with this ${otpRecord.method === OtpDeliveryMethod.EMAIL ? 'email' : 'phone number'}. Please register first.`
        });
      }
    }

    // Update last login timestamp
    await userModel.updateLastLogin(user.id);

    // Generate JWT token
    const token = authUtils.generateToken(user, authMethod);

    // Check if device supports WebAuthn
    const supportsWebAuthn = req.headers['user-agent']?.includes('Chrome') || 
                           req.headers['user-agent']?.includes('Firefox') ||
                           req.headers['user-agent']?.includes('Safari');

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
      },
      isNewUser,
      supportsWebAuthn
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify OTP. Please try again later.'
    });
  }
});

/**
 * Refresh JWT token
 * POST /api/auth/refresh-token
 */
router.post('/refresh-token', authUtils.authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Get full user from database
    const fullUser = await userModel.getUserById(user.id);
    
    if (!fullUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Generate new token
    const token = authUtils.generateToken(fullUser, user.authMethod);
    
    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      token
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh token'
    });
  }
});

/**
 * Validate token
 * POST /api/auth/validate-token
 */
router.post('/validate-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Token is required'
      });
    }
    
    const payload = authUtils.verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        valid: false
      });
    }
    
    return res.status(200).json({
      success: true,
      valid: true,
      user: {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        did: payload.did,
        authMethod: payload.authMethod
      }
    });
  } catch (error) {
    console.error('Error validating token:', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate token'
    });
  }
});

/**
 * Logout (client-side only in MVP)
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  // In MVP, logout is handled client-side by removing the token
  // This endpoint is just for completeness
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
