import { OtpDeliveryMethod, OtpRecord, OtpStatus } from '../types';
import otpGenerator from 'otp-generator';
import twilio from 'twilio';
import sendgrid from '@sendgrid/mail';
import userModel from '../models/user';
import { v4 as uuidv4 } from 'uuid';

// Initialize external services based on environment variables
if (process.env.SENDGRID_API_KEY) {
  sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
}

// Rate limiting cache (in-memory for MVP)
// In production, use Redis or another distributed cache
interface RateLimitRecord {
  count: number;
  firstAttempt: Date;
  lastAttempt: Date;
}

const rateLimitCache = new Map<string, RateLimitRecord>();

// OTP configuration from environment variables
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY || '10', 10);
const OTP_TYPE = process.env.OTP_TYPE || 'numeric';
const OTP_PROVIDER = process.env.OTP_PROVIDER || 'console';
const MAX_OTP_ATTEMPTS = 3;

/**
 * Generate a new OTP code
 * @returns Generated OTP code
 */
export function generateOtp(): string {
  return otpGenerator.generate(OTP_LENGTH, {
    upperCaseAlphabets: OTP_TYPE !== 'numeric',
    lowerCaseAlphabets: OTP_TYPE !== 'numeric',
    specialChars: false,
    digits: true,
  });
}

/**
 * Send OTP via email using SendGrid
 * @param email - Recipient email
 * @param otp - OTP code to send
 * @param purpose - Purpose of the OTP (registration, login, etc.)
 */
async function sendOtpViaEmail(email: string, otp: string, purpose: string): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    console.warn('SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL env variables.');
    return false;
  }

  try {
    const appName = process.env.RP_NAME || 'Hedera ID Wallet';
    let subject: string;
    let textContent: string;
    let htmlContent: string;

    if (purpose === 'registration') {
      subject = `Verify your account for ${appName}`;
      textContent = `Your verification code is: ${otp}. It will expire in ${OTP_EXPIRY_MINUTES} minutes.`;
      htmlContent = `
        <h2>Welcome to ${appName}!</h2>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code will expire in ${OTP_EXPIRY_MINUTES} minutes.</p>
      `;
    } else {
      subject = `Your login code for ${appName}`;
      textContent = `Your login code is: ${otp}. It will expire in ${OTP_EXPIRY_MINUTES} minutes.`;
      htmlContent = `
        <h2>${appName} Login</h2>
        <p>Your login code is: <strong>${otp}</strong></p>
        <p>This code will expire in ${OTP_EXPIRY_MINUTES} minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      `;
    }

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      text: textContent,
      html: htmlContent,
    };

    // Use template if configured
    if (process.env.SENDGRID_TEMPLATE_ID) {
      Object.assign(msg, {
        templateId: process.env.SENDGRID_TEMPLATE_ID,
        dynamicTemplateData: {
          otp,
          expiry: OTP_EXPIRY_MINUTES,
          purpose,
          appName,
        },
      });
    }

    await sendgrid.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending email via SendGrid:', error);
    return false;
  }
}

/**
 * Send OTP via SMS using Twilio
 * @param phone - Recipient phone number
 * @param otp - OTP code to send
 * @param purpose - Purpose of the OTP (registration, login, etc.)
 */
async function sendOtpViaSms(phone: string, otp: string, purpose: string): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn('Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER env variables.');
    return false;
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const appName = process.env.RP_NAME || 'Hedera ID Wallet';
    
    let message: string;
    if (purpose === 'registration') {
      message = `Your ${appName} verification code is: ${otp}. It will expire in ${OTP_EXPIRY_MINUTES} minutes.`;
    } else {
      message = `Your ${appName} login code is: ${otp}. It will expire in ${OTP_EXPIRY_MINUTES} minutes.`;
    }

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    
    return true;
  } catch (error) {
    console.error('Error sending SMS via Twilio:', error);
    return false;
  }
}

/**
 * Log OTP to console (for development)
 * @param recipient - Email or phone
 * @param otp - OTP code
 * @param method - Delivery method
 */
function logOtpToConsole(recipient: string, otp: string, method: OtpDeliveryMethod): void {
  console.log('\n==================================');
  console.log(`🔐 DEV MODE: OTP for ${method.toUpperCase()}`);
  console.log('==================================');
  console.log(`📨 Recipient: ${recipient}`);
  console.log(`🔑 OTP Code: ${otp}`);
  console.log(`⏱️ Expires in: ${OTP_EXPIRY_MINUTES} minutes`);
  console.log('==================================\n');
}

/**
 * Check if a recipient is rate limited
 * @param recipient - Email or phone to check
 * @returns Whether the recipient is rate limited
 */
export function isRateLimited(recipient: string): boolean {
  const record = rateLimitCache.get(recipient);
  
  if (!record) {
    return false;
  }
  
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Reset rate limit if first attempt was more than an hour ago
  if (record.firstAttempt < hourAgo) {
    rateLimitCache.delete(recipient);
    return false;
  }
  
  // Rate limit: 5 OTPs per hour
  return record.count >= 5;
}

/**
 * Update rate limit counter for a recipient
 * @param recipient - Email or phone
 */
function updateRateLimit(recipient: string): void {
  const now = new Date();
  const record = rateLimitCache.get(recipient);
  
  if (!record) {
    rateLimitCache.set(recipient, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
  } else {
    record.count += 1;
    record.lastAttempt = now;
    rateLimitCache.set(recipient, record);
  }
}

/**
 * Validate email format
 * @param email - Email to validate
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 */
export function isValidPhone(phone: string): boolean {
  // Basic validation for E.164 format: +[country code][number]
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Create and send OTP to a recipient
 * @param recipient - Email or phone
 * @param method - Delivery method (email or sms)
 * @param purpose - Purpose of OTP (registration, login, etc.)
 * @param userId - Optional user ID for existing users
 * @returns OTP record if successful, null otherwise
 */
export async function createAndSendOtp(
  recipient: string,
  method: OtpDeliveryMethod,
  purpose: string = 'login',
  userId?: string
): Promise<OtpRecord | null> {
  // Validate recipient format
  if (method === OtpDeliveryMethod.EMAIL && !isValidEmail(recipient)) {
    throw new Error('Invalid email format');
  } else if (method === OtpDeliveryMethod.SMS && !isValidPhone(recipient)) {
    throw new Error('Invalid phone number format');
  }
  
  // Check rate limiting
  if (isRateLimited(recipient)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  // Invalidate any existing OTPs for this recipient
  await userModel.invalidateOtps(recipient);
  
  // Generate new OTP
  const otp = generateOtp();
  
  // Create OTP record
  const otpRecord = await userModel.createOtp(recipient, method, otp, userId);
  
  // Update rate limit
  updateRateLimit(recipient);
  
  // Send OTP based on provider configuration
  let sent = false;
  
  if (OTP_PROVIDER === 'console' || process.env.NODE_ENV === 'development') {
    // Always log to console in development mode
    logOtpToConsole(recipient, otp, method);
    sent = true;
  }
  
  if (OTP_PROVIDER === 'sendgrid' && method === OtpDeliveryMethod.EMAIL) {
    sent = await sendOtpViaEmail(recipient, otp, purpose);
  } else if (OTP_PROVIDER === 'twilio' && method === OtpDeliveryMethod.SMS) {
    sent = await sendOtpViaSms(recipient, otp, purpose);
  }
  
  if (!sent && OTP_PROVIDER !== 'console') {
    // Fallback to console if sending failed
    console.warn(`Failed to send OTP via ${OTP_PROVIDER}. Falling back to console.`);
    logOtpToConsole(recipient, otp, method);
    sent = true;
  }
  
  if (!sent) {
    throw new Error(`Failed to send OTP to ${recipient} via ${method}`);
  }
  
  return otpRecord;
}

/**
 * Verify an OTP code
 * @param otpId - ID of the OTP record
 * @param code - OTP code to verify
 * @returns Verified OTP record if successful, null otherwise
 */
export async function verifyOtp(otpId: string, code: string): Promise<OtpRecord | null> {
  const otpRecord = await userModel.getOtpById(otpId);
  
  if (!otpRecord) {
    throw new Error('Invalid OTP ID');
  }
  
  // Check if OTP is expired
  if (new Date() > otpRecord.expiresAt) {
    return {
      ...otpRecord,
      status: OtpStatus.EXPIRED
    };
  }
  
  // Check if max attempts reached
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error('Maximum verification attempts reached');
  }
  
  // Verify the OTP
  const verifiedOtp = await userModel.verifyOtp(otpId, code);
  
  if (!verifiedOtp) {
    throw new Error('Failed to verify OTP');
  }
  
  return verifiedOtp;
}

export default {
  generateOtp,
  createAndSendOtp,
  verifyOtp,
  isValidEmail,
  isValidPhone,
  isRateLimited
};
