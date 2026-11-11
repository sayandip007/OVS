import { z } from 'zod';
import { AUTH_CONSTANTS } from '../auth/auth.constants.js';

const adminRoleEnum = z.enum([
  'SUPER_ADMIN',
  'NATIONAL_ADMIN',
  'STATE_ADMIN',
  'ELECTION_OFFICER',
  'READ_ONLY_AUDITOR',
]);

const adminStatusEnum = z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']);

const stateCodeSchema = z
  .string()
  .trim()
  .min(2, 'State ID must be at least 2 characters.')
  .max(10, 'State ID cannot exceed 10 characters.')
  .regex(/^[A-Z0-9_-]+$/i, 'State ID contains invalid characters.')
  .transform((val) => val.toUpperCase());

const electionIdSchema = z
  .string()
  .trim()
  .min(2, 'Election ID must be at least 2 characters.')
  .max(50, 'Election ID cannot exceed 50 characters.')
  .regex(/^[A-Z0-9_-]+$/i, 'Election ID contains invalid characters.')
  .transform((val) => val.toUpperCase());

const constituencyScopeItemSchema = z
  .object({
    electionId: electionIdSchema.nullable().optional(),
    constituencyType: z.enum(['PARLIAMENTARY', 'ASSEMBLY']),
    parliamentaryConstituencyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
    assemblyConstituencyId: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase())
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.constituencyType === 'PARLIAMENTARY') {
      if (!item.parliamentaryConstituencyId || item.assemblyConstituencyId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'PARLIAMENTARY scope must specify parliamentaryConstituencyId and omit assemblyConstituencyId.',
        });
      }
    } else {
      if (!item.assemblyConstituencyId || item.parliamentaryConstituencyId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'ASSEMBLY scope must specify assemblyConstituencyId and omit parliamentaryConstituencyId.',
        });
      }
    }
  });

export const adminLoginSchema = z
  .object({
    identifier: z
      .string({ required_error: 'Email or Officer Code is required.' })
      .trim()
      .min(3, 'Identifier must be at least 3 characters.')
      .max(255, 'Identifier is too long.'),
    password: z
      .string({ required_error: 'Password is required.' })
      .min(1, 'Password is required.')
      .max(AUTH_CONSTANTS.ADMIN_PASSWORD_MAX_LENGTH, 'Password exceeds maximum length.'),
  })
  .strict();

export const createAdminUserSchema = z
  .object({
    officerCode: z
      .string({ required_error: 'Officer code is required.' })
      .trim()
      .min(3, 'Officer code must be at least 3 characters.')
      .max(50, 'Officer code cannot exceed 50 characters.')
      .regex(/^[A-Z0-9_-]+$/i, 'Officer code must contain only alphanumeric, underscore, or hyphen characters.')
      .transform((val) => val.toUpperCase()),
    email: z
      .string({ required_error: 'Administrator email is required.' })
      .trim()
      .email('Please provide a valid email address.')
      .max(255, 'Email cannot exceed 255 characters.')
      .transform((val) => val.toLowerCase()),
    fullName: z
      .string({ required_error: 'Full name is required.' })
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(150, 'Full name cannot exceed 150 characters.'),
    designation: z
      .string({ required_error: 'Designation is required.' })
      .trim()
      .min(2, 'Designation must be at least 2 characters.')
      .max(150, 'Designation cannot exceed 150 characters.'),
    role: adminRoleEnum,
    password: z
      .string({ required_error: 'Initial password is required.' })
      .min(
        AUTH_CONSTANTS.ADMIN_PASSWORD_MIN_LENGTH,
        `Password must be at least ${AUTH_CONSTANTS.ADMIN_PASSWORD_MIN_LENGTH} characters.`
      )
      .max(AUTH_CONSTANTS.ADMIN_PASSWORD_MAX_LENGTH),
    assignedStateId: stateCodeSchema.nullable().optional(),
    stateIds: z.array(stateCodeSchema).max(36).optional(),
    electionIds: z.array(electionIdSchema).max(50).optional(),
    constituencyScopes: z.array(constituencyScopeItemSchema).max(100).optional(),
  })
  .strict();

export const updateAdminUserSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(150, 'Full name cannot exceed 150 characters.')
      .optional(),
    designation: z
      .string()
      .trim()
      .min(2, 'Designation must be at least 2 characters.')
      .max(150, 'Designation cannot exceed 150 characters.')
      .optional(),
    email: z
      .string()
      .trim()
      .email('Please provide a valid email address.')
      .max(255, 'Email cannot exceed 255 characters.')
      .transform((val) => val.toLowerCase())
      .optional(),
    role: adminRoleEnum.optional(),
    password: z
      .string()
      .min(AUTH_CONSTANTS.ADMIN_PASSWORD_MIN_LENGTH)
      .max(AUTH_CONSTANTS.ADMIN_PASSWORD_MAX_LENGTH)
      .optional(),
    assignedStateId: stateCodeSchema.nullable().optional(),
    stateIds: z.array(stateCodeSchema).max(36).optional(),
    electionIds: z.array(electionIdSchema).max(50).optional(),
    constituencyScopes: z.array(constituencyScopeItemSchema).max(100).optional(),
  })
  .strict();

export const updateAdminSelfProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(150, 'Full name cannot exceed 150 characters.')
      .optional(),
    designation: z
      .string()
      .trim()
      .min(2, 'Designation must be at least 2 characters.')
      .max(150, 'Designation cannot exceed 150 characters.')
      .optional(),
  })
  .strict();

export const suspendAdminSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, 'A suspension or deactivation reason of at least 3 characters is required.')
      .max(500)
      .default('Administrative suspension by authorized supervisor.'),
    mode: z.enum(['SUSPEND', 'DEACTIVATE']).default('SUSPEND'),
  })
  .strict();

export const activateAdminSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateAdminScopesSchema = z
  .object({
    assignedStateId: stateCodeSchema.nullable().optional(),
    stateIds: z.array(stateCodeSchema).max(36).optional(),
    electionIds: z.array(electionIdSchema).max(50).optional(),
    constituencyScopes: z.array(constituencyScopeItemSchema).max(100).optional(),
  })
  .strict();

export const adminIdParamSchema = z
  .object({
    id: z.string().trim().uuid('Administrator ID must be a valid UUID.'),
  })
  .strict();

export const listAdminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  role: adminRoleEnum.optional(),
  status: adminStatusEnum.optional(),
  stateId: stateCodeSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  domain: z.string().trim().max(50).optional(),
  actionType: z.string().trim().max(50).optional(),
  outcome: z.enum(['SUCCESS', 'FAILURE', 'DENIED']).optional(),
  actorRole: adminRoleEnum.optional(),
  stateId: stateCodeSchema.optional(),
  electionId: electionIdSchema.optional(),
});
