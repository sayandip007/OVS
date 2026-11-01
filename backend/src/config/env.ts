import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });
dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce
      .number({ invalid_type_error: 'PORT must be a valid TCP port number' })
      .int()
      .min(1, 'PORT must be between 1 and 65535')
      .max(65535, 'PORT must be between 1 and 65535')
      .default(5000),
    DATABASE_URL: z
      .string({
        required_error: 'DATABASE_URL is required',
      })
      .min(1, 'DATABASE_URL must not be empty')
      .refine(
        (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
        'DATABASE_URL must be a valid PostgreSQL connection URI starting with postgresql:// or postgres://'
      ),
    CLIENT_ORIGIN: z
      .string()
      .min(1)
      .default('http://localhost:3000')
      .refine((val) => {
        const origins = val
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        if (origins.length === 0) return false;
        return origins.every((origin) => {
          try {
            const parsed = new URL(origin);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
          } catch {
            return false;
          }
        });
      }, 'CLIENT_ORIGIN must contain one or more valid HTTP/HTTPS origin URLs'),
    SESSION_SECRET: z
      .string({
        required_error: 'SESSION_SECRET is required and must be at least 32 characters',
      })
      .min(32, 'SESSION_SECRET must be at least 32 characters long'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    REDIS_URL: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      const lowerSecret = data.SESSION_SECRET.toLowerCase();
      if (
        lowerSecret.includes('replace-with') ||
        lowerSecret.includes('dev-secret') ||
        lowerSecret.includes('dev_session_secret') ||
        lowerSecret.includes('changeme')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message:
            'Insecure placeholder SESSION_SECRET is strictly forbidden when NODE_ENV=production',
        });
      }
    }
  });

export type BackendEnv = z.infer<typeof envSchema> & {
  allowedOrigins: string[];
};

export function parseEnvironment(rawEnv: NodeJS.ProcessEnv = process.env): BackendEnv {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const formattedIssues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid backend environment configuration:\n${formattedIssues}`);
  }

  const allowedOrigins = result.data.CLIENT_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    ...result.data,
    allowedOrigins,
  };
}

export const parseBackendEnv = parseEnvironment;

let cachedEnv: BackendEnv | null = null;

export function getEnv(): BackendEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnvironment(process.env);
  }
  return cachedEnv;
}
