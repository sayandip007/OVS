/**
 * Authentication, Session & Admin Security Constants (Phases 8.3 & 8.4)
 */

export const AUTH_CONSTANTS = Object.freeze({
  SESSION_COOKIE_NAME: 'ovs_session',
  CSRF_HEADER_NAME: 'x-csrf-token',

  // OTP Configuration
  OTP_LENGTH: 6,
  OTP_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
  OTP_MAX_ATTEMPTS: 3,

  // Session Configuration
  SESSION_DURATION_MS: 8 * 60 * 60 * 1000, // 8 hours absolute lifetime
  SESSION_INACTIVITY_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes idle timeout
  SESSION_ACTIVITY_REFRESH_INTERVAL_MS: 60 * 1000, // Throttle DB writes to 1/min
  SESSION_COOKIE_PATH: '/',

  // Admin Password & Brute-Force Protection
  ADMIN_PASSWORD_MIN_LENGTH: 12,
  ADMIN_PASSWORD_MAX_LENGTH: 128,
  ADMIN_MAX_FAILED_ATTEMPTS: 5,
  ADMIN_LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes

  // Deterministic Demo Codes (for DevelopmentOtpProvider & local inspection only)
  DEMO_OTP_PRIMARY: '123456',
  DEMO_OTP_RESEND: '654321',

  // Rate Limiting Constants
  OTP_REQUEST_RATE_LIMIT_MAX: 10, // 10 requests per 15 minutes per IP/identifier
  OTP_VERIFY_RATE_LIMIT_MAX: 15, // 15 verification attempts per 15 minutes per IP
  ADMIN_LOGIN_RATE_LIMIT_MAX: 10, // 10 admin login attempts per 15 minutes per IP
});
