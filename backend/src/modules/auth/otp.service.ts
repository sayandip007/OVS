import crypto from 'node:crypto';
import { AUTH_CONSTANTS } from './auth.constants.js';

export interface OtpDeliveryProvider {
  readonly name: string;
  sendOtp(identifier: string, mobile: string, otp: string): Promise<boolean>;
  getLastOtp?(identifier: string): string | null;
}

/**
 * Development & Test OTP Delivery Provider.
 * Safely maintains in-memory record of generated OTPs for automated tests and local development.
 * Strictly blocks inspection when NODE_ENV === 'production'.
 */
export class DevelopmentOtpProvider implements OtpDeliveryProvider {
  public readonly name = 'DevelopmentOtpProvider';
  private static readonly otpStore = new Map<
    string,
    { otp: string; timestamp: number }
  >();

  async sendOtp(identifier: string, mobile: string, otp: string): Promise<boolean> {
    const key = identifier.toUpperCase();
    DevelopmentOtpProvider.otpStore.set(key, { otp, timestamp: Date.now() });
    if (mobile) {
      DevelopmentOtpProvider.otpStore.set(mobile, { otp, timestamp: Date.now() });
    }
    return true;
  }

  getLastOtp(identifier: string): string | null {
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
      return null;
    }
    if (process.env.ALLOW_OTP_INSPECTION !== 'true') {
      return null;
    }
    const entry =
      DevelopmentOtpProvider.otpStore.get(identifier.toUpperCase()) ||
      DevelopmentOtpProvider.otpStore.get(identifier);
    if (!entry) return null;
    // Expire from memory after 10 minutes
    if (Date.now() - entry.timestamp > 10 * 60 * 1000) {
      DevelopmentOtpProvider.otpStore.delete(identifier.toUpperCase());
      return null;
    }
    return entry.otp;
  }

  static clear(): void {
    DevelopmentOtpProvider.otpStore.clear();
  }
}

/**
 * Production Disabled OTP Delivery Provider.
 * Safely fails closed when real SMS gateway integration is not configured.
 * Never fakes delivery, never returns true when no message was sent.
 */
export class ProductionDisabledOtpProvider implements OtpDeliveryProvider {
  public readonly name = 'ProductionDisabledOtpProvider';

  async sendOtp(_identifier: string, _mobile: string, _otp: string): Promise<boolean> {
    throw new Error(
      'SMS_DELIVERY_UNAVAILABLE: Real SMS delivery provider is not configured. Automated simulated delivery is disabled in production and staging environments for security.'
    );
  }

  getLastOtp(_identifier: string): string | null {
    return null;
  }
}

/**
 * Resolves the appropriate OTP delivery provider based on runtime environment.
 * In development or test, returns DevelopmentOtpProvider.
 * In production or staging, returns ProductionDisabledOtpProvider (unless an explicit provider is injected).
 */
export function resolveOtpProvider(
  explicitProvider?: OtpDeliveryProvider,
  nodeEnv: string = process.env.NODE_ENV || 'development'
): OtpDeliveryProvider {
  if (explicitProvider) {
    return explicitProvider;
  }
  if (nodeEnv === 'production' || nodeEnv === 'staging') {
    return new ProductionDisabledOtpProvider();
  }
  return new DevelopmentOtpProvider();
}

/**
 * Future SMS Gateway Delivery Provider.
 * Stub for regulated TRAI DLT SMS gateway integration.
 */
export class FutureSmsProvider implements OtpDeliveryProvider {
  public readonly name = 'FutureSmsProvider';

  async sendOtp(_identifier: string, _mobile: string, _otp: string): Promise<boolean> {
    // In an authorized real system, would call authenticated SMS API
    throw new Error(
      'FutureSmsProvider is a placeholder. Real SMS delivery is not configured in this educational prototype.'
    );
  }
}

export class OtpService {
  constructor(
    private readonly provider: OtpDeliveryProvider = resolveOtpProvider()
  ) {}

  getProvider(): OtpDeliveryProvider {
    return this.provider;
  }

  /**
   * Generates a cryptographically secure 6-digit numeric OTP.
   */
  generateSecureOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Hashes an OTP with a secret key using HMAC-SHA256.
   * Produces a 64-character hex string.
   */
  hashOtp(otp: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(otp.trim()).digest('hex');
  }

  /**
   * Verifies an OTP against an expected hash using constant-time buffer comparison.
   */
  verifyOtpHash(inputOtp: string, expectedHash: string, secret: string): boolean {
    if (!inputOtp || !expectedHash) return false;
    const computedHash = this.hashOtp(inputOtp, secret);
    
    const computedBuf = Buffer.from(computedHash, 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');

    if (computedBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, expectedBuf);
  }

  /**
   * Sends an OTP via the configured provider.
   */
  async deliverOtp(
    identifier: string,
    mobile: string,
    otp: string
  ): Promise<boolean> {
    return this.provider.sendOtp(identifier, mobile, otp);
  }
}

/** Standalone convenience helpers for unit testing & functional usage */
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(otp: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(otp.trim()).digest('hex');
}

export function verifyOtpDigest(inputOtp: string, expectedHash: string, secret: string): boolean {
  if (!inputOtp || !expectedHash) return false;
  const computedHash = hashOtp(inputOtp, secret);
  const computedBuf = Buffer.from(computedHash, 'hex');
  const expectedBuf = Buffer.from(expectedHash, 'hex');

  if (computedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(computedBuf, expectedBuf);
}

export function isOtpExpired(createdAt: Date, ttlSeconds: number = AUTH_CONSTANTS.OTP_EXPIRY_MS / 1000): boolean {
  const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);
  return Date.now() > expiresAt.getTime();
}

export function isOtpLocked(attempts: number, maxAttempts: number = AUTH_CONSTANTS.OTP_MAX_ATTEMPTS): boolean {
  return attempts >= maxAttempts;
}
