/**
 * @file Environment configuration
 * @description Validates and exports all required environment variables.
 * Fails fast at startup if any required variable is missing or malformed,
 * preventing the server from running in a misconfigured state.
 */

import { z } from 'zod';

// dotenv/config is imported in server.js before anything else runs;
// this module simply reads process.env after that has happened.

/**
 * Zod schema that defines and validates every environment variable the server
 * depends on. Any missing or invalid variable causes the process to exit.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  SERVER_HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // JWT — enforce minimum length to prevent weak secrets
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // CORS — comma-separated origin list
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // File uploads
  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().min(1).max(100).default(10),
  UPLOAD_DIR: z.string().default('./uploads'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(100),

  // SLA (minutes)
  SLA_CRITICAL_RESPONSE_MINUTES: z.coerce.number().int().default(60),
  SLA_CRITICAL_RESOLUTION_MINUTES: z.coerce.number().int().default(240),
  SLA_HIGH_RESPONSE_MINUTES: z.coerce.number().int().default(240),
  SLA_HIGH_RESOLUTION_MINUTES: z.coerce.number().int().default(480),
  SLA_MEDIUM_RESPONSE_MINUTES: z.coerce.number().int().default(480),
  SLA_MEDIUM_RESOLUTION_MINUTES: z.coerce.number().int().default(1440),
  SLA_LOW_RESPONSE_MINUTES: z.coerce.number().int().default(1440),
  SLA_LOW_RESOLUTION_MINUTES: z.coerce.number().int().default(4320),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables — server cannot start:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/** Validated, typed environment configuration */
export const env = parsed.data;

/** Parsed CORS origins as an array for use with the cors() middleware */
export const corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
