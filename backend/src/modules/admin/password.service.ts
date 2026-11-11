import crypto from 'node:crypto';
import { AUTH_CONSTANTS } from '../auth/auth.constants.js';

const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64,
  maxmem: 32 * 1024 * 1024,
} as const;

export interface PasswordPolicyResult {
  valid: boolean;
  reasons: string[];
}

/**
 * Password hashing and verification using Node.js native OpenSSL scrypt KDF.
 * Produces standard PHC-formatted digests: `$scrypt$N=16384,r=8,p=1$<salt_hex>$<hash_hex>`.
 */
export class PasswordService {
  /**
   * Hashes a plaintext password with a 16-byte cryptographic random salt using scrypt.
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        SCRYPT_PARAMS.keylen,
        {
          N: SCRYPT_PARAMS.N,
          r: SCRYPT_PARAMS.r,
          p: SCRYPT_PARAMS.p,
          maxmem: SCRYPT_PARAMS.maxmem,
        },
        (err, key) => {
          if (err) reject(err);
          else resolve(key);
        }
      );
    });

    return `$scrypt$N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }

  /**
   * Verifies a candidate password against a stored PHC scrypt hash using constant-time equality.
   */
  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (!password || !storedHash || !storedHash.startsWith('$scrypt$')) {
      return false;
    }

    const parts = storedHash.split('$');
    // Format: ["", "scrypt", "N=16384,r=8,p=1", "<salt_hex>", "<hash_hex>"]
    if (parts.length !== 5) {
      return false;
    }

    const paramSegment = parts[2]!;
    const saltHex = parts[3]!;
    const expectedHex = parts[4]!;

    const parsedParams = new Map<string, number>();
    for (const kv of paramSegment.split(',')) {
      const [k, v] = kv.split('=');
      if (k && v) {
        const num = Number(v);
        if (!Number.isFinite(num) || num <= 0) return false;
        parsedParams.set(k, num);
      }
    }

    const N = parsedParams.get('N');
    const r = parsedParams.get('r');
    const p = parsedParams.get('p');
    if (!N || !r || !p) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (salt.length === 0 || expectedBuf.length === 0) {
      return false;
    }

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        expectedBuf.length,
        { N, r, p, maxmem: 64 * 1024 * 1024 },
        (err, key) => {
          if (err) reject(err);
          else resolve(key);
        }
      );
    });

    if (derivedKey.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedBuf);
  }

  /**
   * Equalizes timing when a login identifier does not match an administrator account.
   */
  async simulateVerifyTiming(candidatePassword: string): Promise<void> {
    const dummySalt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    await new Promise<void>((resolve) => {
      crypto.scrypt(
        candidatePassword || 'dummy-password-equalization',
        dummySalt,
        SCRYPT_PARAMS.keylen,
        {
          N: SCRYPT_PARAMS.N,
          r: SCRYPT_PARAMS.r,
          p: SCRYPT_PARAMS.p,
          maxmem: SCRYPT_PARAMS.maxmem,
        },
        () => resolve()
      );
    });
  }

  /**
   * Validates administrator password complexity and hygiene policy.
   */
  validatePasswordPolicy(
    password: string,
    context?: { officerCode?: string; email?: string }
  ): PasswordPolicyResult {
    const reasons: string[] = [];

    if (password.length < AUTH_CONSTANTS.ADMIN_PASSWORD_MIN_LENGTH) {
      reasons.push(
        `Password must be at least ${AUTH_CONSTANTS.ADMIN_PASSWORD_MIN_LENGTH} characters long.`
      );
    }
    if (password.length > AUTH_CONSTANTS.ADMIN_PASSWORD_MAX_LENGTH) {
      reasons.push(
        `Password must be at most ${AUTH_CONSTANTS.ADMIN_PASSWORD_MAX_LENGTH} characters long.`
      );
    }
    if (!/[A-Z]/.test(password)) {
      reasons.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
      reasons.push('Password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
      reasons.push('Password must contain at least one numeric digit.');
    }
    if (!/[^A-Za-z0-9\s]/.test(password)) {
      reasons.push('Password must contain at least one special character.');
    }
    if (/^\s|\s$/.test(password)) {
      reasons.push('Password must not start or end with whitespace.');
    }

    const lowerPwd = password.toLowerCase();
    if (context?.officerCode && context.officerCode.length >= 3) {
      if (lowerPwd.includes(context.officerCode.trim().toLowerCase())) {
        reasons.push('Password must not contain your officer code.');
      }
    }
    if (context?.email) {
      const localPart = context.email.split('@')[0]?.trim().toLowerCase();
      if (localPart && localPart.length >= 3 && lowerPwd.includes(localPart)) {
        reasons.push('Password must not contain your email username.');
      }
    }

    return {
      valid: reasons.length === 0,
      reasons,
    };
  }
}
