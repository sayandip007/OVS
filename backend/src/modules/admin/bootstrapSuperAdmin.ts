import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PasswordService } from './password.service.js';
import { AdminAuditService } from './admin.audit.service.js';

dotenv.config({ path: './backend/.env' });
dotenv.config();

export interface BootstrapSuperAdminOptions {
  officerCode: string;
  email: string;
  fullName: string;
  designation?: string;
  password: string;
}

/**
 * Controlled SUPER_ADMIN bootstrap utility.
 * Never hardcodes production credentials — requires explicit caller or env values.
 */
export async function bootstrapSuperAdmin(
  prisma: PrismaClient,
  options: BootstrapSuperAdminOptions
): Promise<{ created: boolean; adminUserId: string; officerCode: string }> {
  const officerCode = options.officerCode.trim().toUpperCase();
  const email = options.email.trim().toLowerCase();
  const fullName = options.fullName.trim();
  const designation = (
    options.designation ?? 'Chief Election Commissioner (Bootstrapped)'
  ).trim();

  if (!officerCode || !email || !fullName || !options.password) {
    throw new Error(
      'Missing required bootstrap parameters: officerCode, email, fullName, and password are required.'
    );
  }

  const passwordService = new PasswordService();
  const policy = passwordService.validatePasswordPolicy(options.password, {
    officerCode,
    email,
  });

  if (!policy.valid) {
    throw new Error(
      `Bootstrap password violates security policy:\n - ${policy.reasons.join('\n - ')}`
    );
  }

  const existing = await prisma.adminUser.findFirst({
    where: {
      OR: [{ officerCode }, { email }],
    },
  });

  if (existing) {
    return {
      created: false,
      adminUserId: existing.id,
      officerCode: existing.officerCode,
    };
  }

  const passwordHash = await passwordService.hashPassword(options.password);

  const createdAdmin = await prisma.$transaction(async (tx) => {
    return tx.adminUser.create({
      data: {
        officerCode,
        email,
        fullName,
        designation,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        isActive: true,
        passwordUpdatedAt: new Date(),
        user: {
          create: {
            userType: 'ADMIN',
            identifier: officerCode,
            passwordHash,
            isActive: true,
          },
        },
      },
    });
  });

  const auditService = new AdminAuditService(prisma);
  await auditService.recordSecurityEvent({
    adminUserId: createdAdmin.id,
    actorUserId: createdAdmin.userId,
    actorIdentifier: createdAdmin.officerCode,
    actorRole: 'SUPER_ADMIN',
    actionType: 'SUPER_ADMIN_BOOTSTRAPPED',
    domain: 'ADMIN_BOOTSTRAP',
    targetEntityId: createdAdmin.id,
    outcome: 'SUCCESS',
    details: { officerCode: createdAdmin.officerCode },
  });

  return {
    created: true,
    adminUserId: createdAdmin.id,
    officerCode: createdAdmin.officerCode,
  };
}

// Direct CLI execution entrypoint (`tsx backend/src/modules/admin/bootstrapSuperAdmin.ts`)
const isDirectExecution =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.endsWith('bootstrapSuperAdmin.ts');

if (isDirectExecution) {
  const officerCode = process.env.BOOTSTRAP_SUPER_ADMIN_CODE || '';
  const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || '';
  const fullName = process.env.BOOTSTRAP_SUPER_ADMIN_NAME || '';
  const designation = process.env.BOOTSTRAP_SUPER_ADMIN_DESIGNATION;
  const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || '';

  if (!officerCode || !email || !fullName || !password) {
    console.error(
      'Error: Set BOOTSTRAP_SUPER_ADMIN_CODE, BOOTSTRAP_SUPER_ADMIN_EMAIL, BOOTSTRAP_SUPER_ADMIN_NAME, and BOOTSTRAP_SUPER_ADMIN_PASSWORD environment variables.'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  bootstrapSuperAdmin(prisma, {
    officerCode,
    email,
    fullName,
    designation,
    password,
  })
    .then((result) => {
      console.log(
        result.created
          ? `Bootstrapped SUPER_ADMIN '${result.officerCode}' (${result.adminUserId}).`
          : `SUPER_ADMIN '${result.officerCode}' already exists (${result.adminUserId}). No changes made.`
      );
    })
    .catch((err) => {
      console.error('Bootstrap failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
