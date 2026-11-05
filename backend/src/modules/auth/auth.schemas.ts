import { z } from 'zod';

/**
 * Normalizes an Indian mobile number to 10 digits.
 * Accepts formats: +919876543210, 09876543210, 9876543210, 98765-43210.
 */
export function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Normalizes an email address to trimmed lowercase.
 */
export function normalizeEmail(input?: string): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Validates that the date of birth corresponds to an age of at least 18 years.
 */
function isAtLeast18YearsOld(dobString: string): boolean {
  const birthDate = new Date(dobString);
  if (Number.isNaN(birthDate.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 18;
}

export const registerVoterSchema = z
  .preprocess((val: any) => {
    if (typeof val === 'object' && val !== null) {
      const copy = { ...val };
      if (!copy.epicNumber && copy.epicReference) {
        copy.epicNumber = copy.epicReference;
        delete copy.epicReference;
      }
      if (!copy.mobile && (copy.mobileNumber || copy.phoneNumber)) {
        copy.mobile = copy.mobileNumber || copy.phoneNumber;
        delete copy.mobileNumber;
        delete copy.phoneNumber;
      }
      if (!copy.gender) {
        copy.gender = 'OTHER';
      }
      if (!copy.address) {
        copy.address = 'Demonstration Address, India';
      }
      if (!copy.pinCode) {
        copy.pinCode = '741101';
      }
      return copy;
    }
    return val;
  }, z.object({
    epicNumber: z
      .string({ required_error: 'EPIC number is required.' })
      .trim()
      .min(5, 'EPIC number must be at least 5 characters.')
      .max(20, 'EPIC number must be at most 20 characters.')
      .regex(/^[A-Z0-9_-]+$/i, 'EPIC number must contain only alphanumeric characters.')
      .transform((val) => val.toUpperCase()),

    fullName: z
      .string({ required_error: 'Full name is required.' })
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(150, 'Full name must be at most 150 characters.')
      .regex(/^[\p{L}\p{M}\s.'-]+$/u, 'Full name contains invalid characters.'),

    dateOfBirth: z
      .string({ required_error: 'Date of birth is required.' })
      .trim()
      .refine(
        (val) => !Number.isNaN(new Date(val).getTime()),
        'Date of birth must be a valid date format (YYYY-MM-DD).'
      )
      .refine(
        (val) => isAtLeast18YearsOld(val),
        'Voter must be at least 18 years old to register.'
      ),

    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'THIRD_GENDER'], {
      errorMap: () => ({
        message: 'Gender must be MALE, FEMALE, OTHER, or THIRD_GENDER.',
      }),
    }),

    mobile: z
      .string({ required_error: 'Mobile number is required.' })
      .trim()
      .transform(normalizeMobile)
      .refine((val) => val.length === 10, 'Mobile number must be a valid 10-digit number.'),

    email: z
      .string({ required_error: 'Email address is required.' })
      .trim()
      .email('Please provide a valid email address.')
      .max(255, 'Email cannot exceed 255 characters.')
      .transform((val) => val.toLowerCase()),

    address: z
      .string({ required_error: 'Address is required.' })
      .trim()
      .min(5, 'Address must be at least 5 characters.')
      .max(500, 'Address must be at most 500 characters.'),

    pinCode: z
      .string({ required_error: 'PIN code is required.' })
      .trim()
      .regex(/^[1-9][0-9]{5}$/, 'PIN code must be a valid 6-digit Indian postal code.'),

    stateId: z
      .string({ required_error: 'State ID is required.' })
      .trim()
      .min(2, 'State ID is required.')
      .max(10, 'State ID is invalid.')
      .transform((val) => val.toUpperCase()),

    districtId: z
      .string({ required_error: 'District ID is required.' })
      .trim()
      .min(2, 'District ID is required.')
      .max(50, 'District ID is invalid.')
      .transform((val) => val.toUpperCase()),

    parliamentaryConstituencyId: z
      .string({ required_error: 'Parliamentary constituency ID is required.' })
      .trim()
      .min(2, 'Parliamentary constituency ID is required.')
      .max(50, 'Parliamentary constituency ID is invalid.')
      .transform((val) => val.toUpperCase()),

    assemblyConstituencyId: z
      .string({ required_error: 'Assembly constituency ID is required.' })
      .trim()
      .min(2, 'Assembly constituency ID is required.')
      .max(50, 'Assembly constituency ID is invalid.')
      .transform((val) => val.toUpperCase()),
  }).strict())
  .transform((data) => ({
    ...data,
    mobileNumber: data.mobile,
  }));

export const requestOtpSchema = z
  .preprocess((val: any) => {
    if (typeof val === 'object' && val !== null) {
      const copy = { ...val };
      if (!copy.identifier && (copy.voterIdentifier || copy.mobileNumber || copy.mobile || copy.phoneNumber)) {
        copy.identifier = copy.voterIdentifier || copy.mobileNumber || copy.mobile || copy.phoneNumber;
      }
      return copy;
    }
    return val;
  }, z.object({
    identifier: z
      .string({ required_error: 'Login identifier or registered mobile is required.' })
      .trim()
      .min(3, 'Identifier must be at least 3 characters.')
      .max(100, 'Identifier is too long.'),
    phoneNumber: z.string().trim().optional(),
    mobileNumber: z.string().trim().optional(),
  }).refine(
    (data) => {
      // If identifier is predominantly numeric, enforce 10-digit mobile rule
      const digits = data.identifier.replace(/\D/g, '');
      if (/^\+?[0-9\s-]+$/.test(data.identifier) && digits.length > 0) {
        const normalized = normalizeMobile(data.identifier);
        return normalized.length === 10;
      }
      return true;
    },
    {
      message: 'Mobile number must be a valid 10-digit number.',
      path: ['identifier'],
    }
  ))
  .transform((data) => {
    const rawMobile = data.mobileNumber || data.phoneNumber || data.identifier;
    const normalized = normalizeMobile(rawMobile);
    return {
      ...data,
      mobileNumber: normalized.length === 10 ? normalized : rawMobile,
    };
  });

export const verifyOtpSchema = z
  .object({
    challengeId: z
      .string({ required_error: 'Challenge ID is required.' })
      .trim()
      .uuid('Challenge ID must be a valid UUID.'),
    otp: z
      .string({ required_error: 'OTP code is required.' })
      .trim()
      .regex(/^[0-9]{6}$/, 'OTP must be a 6-digit numeric code.'),
  })
  .strict();

export const sessionIdParamSchema = z
  .object({
    sessionId: z
      .string({ required_error: 'Session ID is required.' })
      .trim()
      .min(10, 'Session ID is invalid.')
      .max(128, 'Session ID is invalid.'),
  })
  .strict();
