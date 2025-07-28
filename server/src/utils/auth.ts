import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { UserJwtPayload, AuthMethod, User } from '../types';
import userModel from '../models/user';

// Default JWT expiration time (from env or 24h)
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const JWT_SECRET = process.env.JWT_SECRET;

// Ensure JWT secret is set
if (!JWT_SECRET) {
  console.error('JWT_SECRET environment variable is not set!');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

/**
 * Generate a JWT token for a user
 * @param user - User object
 * @param authMethod - Authentication method used
 * @returns JWT token string
 */
export function generateToken(user: User, authMethod: AuthMethod): string {
  if (!JWT_SECRET) {
    throw new Error('JWT secret not configured');
  }

  const payload: UserJwtPayload = {
    id: user.id,
    did: user.did,
    email: user.email,
    phone: user.phone,
    name: user.name,
    authMethod
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify a JWT token
 * @param token - JWT token to verify
 * @returns Decoded payload if valid, null otherwise
 */
export function verifyToken(token: string): UserJwtPayload | null {
  if (!JWT_SECRET) {
    throw new Error('JWT secret not configured');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserJwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param req - Express request
 * @returns Token string if found, null otherwise
 */
export function extractTokenFromHeader(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.split(' ')[1];
}

/**
 * Get user from token
 * @param token - JWT token
 * @returns User object if found, null otherwise
 */
export async function getUserFromToken(token: string): Promise<User | null> {
  const payload = verifyToken(token);
  
  if (!payload || !payload.id) {
    return null;
  }
  
  return await userModel.getUserById(payload.id);
}

/**
 * Middleware to authenticate requests
 * Adds user object to request if authenticated
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromHeader(req);
  
  if (!token) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication token is missing' 
    });
    return;
  }
  
  const payload = verifyToken(token);
  
  if (!payload) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or expired token' 
    });
    return;
  }
  
  // Add user payload to request
  (req as any).user = payload;
  next();
}

/**
 * Middleware to require specific authentication method
 * Must be used after authenticate middleware
 * @param methods - Allowed authentication methods
 */
export function requireAuthMethod(methods: AuthMethod | AuthMethod[]) {
  const allowedMethods = Array.isArray(methods) ? methods : [methods];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as UserJwtPayload;
    
    if (!user) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
      return;
    }
    
    if (!allowedMethods.includes(user.authMethod)) {
      res.status(403).json({ 
        error: 'Forbidden', 
        message: `Authentication method ${user.authMethod} not allowed for this operation` 
      });
      return;
    }
    
    next();
  };
}

/**
 * Middleware to load full user object from database
 * Must be used after authenticate middleware
 * Adds full user object to request
 */
export function loadUser(req: Request, res: Response, next: NextFunction): void {
  const userPayload = (req as any).user as UserJwtPayload;
  
  if (!userPayload || !userPayload.id) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
    return;
  }
  
  userModel.getUserById(userPayload.id)
    .then(user => {
      if (!user) {
        res.status(404).json({ 
          error: 'Not Found', 
          message: 'User not found' 
        });
        return;
      }
      
      // Add full user object to request
      (req as any).fullUser = user;
      next();
    })
    .catch(error => {
      console.error('Error loading user:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to load user data' 
      });
    });
}

/**
 * Check if a token is valid and not expired
 * @param token - JWT token to check
 * @returns Whether the token is valid
 */
export function isValidToken(token: string): boolean {
  return verifyToken(token) !== null;
}

/**
 * Refresh a JWT token if it's about to expire
 * @param token - Current JWT token
 * @returns New token if refreshed, original token otherwise
 */
export async function refreshTokenIfNeeded(token: string): Promise<string> {
  const payload = verifyToken(token);
  
  if (!payload) {
    throw new Error('Invalid token');
  }
  
  // Check if token is about to expire (less than 1 hour left)
  const expiryTime = payload.exp || 0;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const oneHourInSeconds = 60 * 60;
  
  if (expiryTime - nowInSeconds < oneHourInSeconds) {
    // Token is about to expire, refresh it
    const user = await userModel.getUserById(payload.id);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return generateToken(user, payload.authMethod);
  }
  
  // Token is still valid for more than 1 hour
  return token;
}

export default {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  getUserFromToken,
  authenticate,
  requireAuthMethod,
  loadUser,
  isValidToken,
  refreshTokenIfNeeded
};
