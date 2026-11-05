/**
 * Authentication & Session Management Constants (Phase 8.3)
 */

export const AUTH_CONSTANTS = Object.freeze({
  SESSION_COOKIE_NAME: 'ovs_session',
  CSRF_HEADER_NAME: 'x-csrf-token',
  
  // OTP Configuration
  OTP_LENGTH: 6,
  OTP_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
  OTP_MAX_ATTEMPTS: 3,
  
  // Session Configuration
  SESSION_DURATION_MS: 8 * 60 * 60 * 1000, // 8 hours
  SESSION_COOKIE_PATH: '/',
  
  // Deterministic Demo Codes (for DevelopmentOtpProvider & local inspection only)
  DEMO_OTP_PRIMARY: '123456',
  DEMO_OTP_RESEND: '654321',

  // Rate Limiting Constants
  OTP_REQUEST_RATE_LIMIT_MAX: 10, // 10 requests per 15 minutes per IP/identifier
  OTP_VERIFY_RATE_LIMIT_MAX: 15,  // 15 verification attempts per 15 minutes per IP
});

