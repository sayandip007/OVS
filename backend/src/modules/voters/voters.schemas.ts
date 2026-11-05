import { z } from 'zod';
import { normalizeMobile } from '../auth/auth.schemas.js';

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

export const updateVoterProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(150, 'Full name must be at most 150 characters.')
      .regex(/^[\p{L}\p{M}\s.'-]+$/u, 'Full name contains invalid characters.')
      .optional(),

    email: z
      .string()
      .trim()
      .email('Please provide a valid email address.')
      .max(255, 'Email cannot exceed 255 characters.')
      .transform((val) => val.toLowerCase())
      .optional(),

    mobile: z
      .string()
      .trim()
      .transform(normalizeMobile)
      .refine((val) => val.length === 10, 'Mobile number must be a valid 10-digit number.')
      .optional(),

    address: z
      .string()
      .trim()
      .min(5, 'Address must be at least 5 characters.')
      .max(500, 'Address must be at most 500 characters.')
      .optional(),

    pinCode: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{5}$/, 'PIN code must be a valid 6-digit Indian postal code.')
      .optional(),

    dateOfBirth: z
      .string()
      .trim()
      .refine(
        (val) => !Number.isNaN(new Date(val).getTime()),
        'Date of birth must be a valid date format (YYYY-MM-DD).'
      )
      .refine(
        (val) => isAtLeast18YearsOld(val),
        'Voter must be at least 18 years old.'
      )
      .optional(),

    gender: z
      .enum(['MALE', 'FEMALE', 'OTHER', 'THIRD_GENDER'], {
        errorMap: () => ({
          message: 'Gender must be MALE, FEMALE, OTHER, or THIRD_GENDER.',
        }),
      })
      .optional(),

    stateId: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .transform((val) => val.toUpperCase())
      .optional(),

    districtId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((val) => val.toUpperCase())
      .optional(),

    parliamentaryConstituencyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((val) => val.toUpperCase())
      .optional(),

    assemblyConstituencyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((val) => val.toUpperCase())
      .optional(),
  })
  .strict(); // Rejects any forbidden keys like userType, role, epicNumber, id, userId, isVerified, etc.

