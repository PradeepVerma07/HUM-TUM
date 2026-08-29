import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const isProduction = process.env.NODE_ENV === 'production';
const forbiddenSecrets = new Set([
  ['development-only', 'secret'].join('-'),
  'replace-this-with-a-long-random-secret',
  'replace-with-a-64-character-random-secret-before-use',
  'change-me',
  'changeme',
]);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_URL: z.string().url().optional(),
  CLIENT_ORIGIN: z.string().url().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().min(3).default('ci360-realtime-app'),
  JWT_AUDIENCE: z.string().min(3).default('ci360-dashboard'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(3600).default(900),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  DATABASE_PATH: z.string().min(1).default('./data/ci360.db'),
  UPLOAD_DIR: z.string().min(1).default('./data/private-uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(25).default(10),
  TRUST_PROXY: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${message}`);
}

const clientUrl = parsed.data.CLIENT_URL || parsed.data.CLIENT_ORIGIN;
if (isProduction && !clientUrl) throw new Error('CLIENT_URL is required in production.');
if (forbiddenSecrets.has(parsed.data.JWT_SECRET.trim().toLowerCase()))
  throw new Error('JWT_SECRET must not use a default or placeholder value.');

export const config = {
  ...parsed.data,
  CLIENT_URL: clientUrl || 'http://localhost:5173',
  isProduction,
  uploadDir: path.resolve(process.cwd(), parsed.data.UPLOAD_DIR),
  maxUploadBytes: parsed.data.MAX_UPLOAD_MB * 1024 * 1024,
};
