import { z } from 'zod';

const numberFromEnv = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : fallback))
    .pipe(z.number().int().positive());

const booleanFromEnv = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())));

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'log', 'info', 'warn', 'error']).optional(),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  API_APP_URL: z.string().url().default('http://localhost:4000'),
  API_PORT: numberFromEnv(4000),
  ERROR_TRACKING_WEBHOOK_URL: z.string().optional().default(''),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  RATE_LIMIT_REDIS_ENABLED: booleanFromEnv(false),
  SESSION_SECRET: z.string().min(16).default('local-session-secret-change-me'),
  CSRF_SECRET: z.string().min(16).default('local-csrf-secret-change-me'),
  SESSION_COOKIE_NAME: z.string().default('neara.sid'),
  MAILTRAP_HOST: z.string().default('sandbox.smtp.mailtrap.io'),
  MAILTRAP_PORT: numberFromEnv(2525),
  MAILTRAP_USERNAME: z.string().optional().default(''),
  MAILTRAP_PASSWORD: z.string().optional().default(''),
  MAIL_FROM: z.string().default('no-reply@neara.local'),
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  S3_ENDPOINT: z.string().optional().default('http://localhost:9000'),
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().default('neara-local'),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_PUBLIC_BASE_URL: z.string().optional().default('http://localhost:9000/neara-local'),
  UPLOAD_MAX_IMAGE_BYTES: numberFromEnv(5242880),
  RATE_LIMIT_PUBLIC_SEARCH_PER_MINUTE: numberFromEnv(100),
  RATE_LIMIT_PUBLIC_SLOT_LOOKUP_PER_MINUTE: numberFromEnv(120),
  RATE_LIMIT_PUBLIC_BOOKING_CREATE_PER_MINUTE: numberFromEnv(20),
  RATE_LIMIT_PUBLIC_BOOKING_LOOKUP_PER_MINUTE: numberFromEnv(30),
  RATE_LIMIT_ADMIN_LOGIN_PER_WINDOW: numberFromEnv(10),
  RATE_LIMIT_PASSWORD_RESET_PER_HOUR: numberFromEnv(5),
  RATE_LIMIT_CUSTOMER_REGISTER_PER_MINUTE: numberFromEnv(10),
  RATE_LIMIT_CUSTOMER_LOGIN_PER_MINUTE: numberFromEnv(10),
  RATE_LIMIT_CUSTOMER_OTP_REQUEST_PER_HOUR: numberFromEnv(5),
  RATE_LIMIT_CUSTOMER_OTP_CONFIRM_PER_MINUTE: numberFromEnv(20),
  RATE_LIMIT_WINDOW_SECONDS: numberFromEnv(60),
  CUSTOMER_SESSION_COOKIE_NAME: z.string().default('neara.customer.sid'),
});
