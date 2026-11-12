import { z } from 'zod';

const numberFromEnv = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : fallback))
    .pipe(z.number().int().positive());

const booleanFromEnv = (fallback: 'true' | 'false') =>
  z
    .string()
    .optional()
    .transform((value) => (value ?? fallback))
    .pipe(z.enum(['true', 'false']));

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'log', 'info', 'warn', 'error']).optional(),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  CORS_ALLOWED_ORIGINS: z.string().optional().default(''),
  API_APP_URL: z.string().url().default('http://localhost:4000'),
  API_PORT: numberFromEnv(4000),
  ERROR_TRACKING_WEBHOOK_URL: z.string().optional().default(''),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional().default(''),
  UPSTASH_REDIS_REST_URL: z.string().optional().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(''),
  SESSION_SECRET: z.string().min(16).default('local-session-secret-change-me'),
  CSRF_SECRET: z.string().min(16).default('local-csrf-secret-change-me'),
  SESSION_COOKIE_NAME: z.string().default('neara.sid'),
  RESEND_SMTP_HOST: z.string().default('smtp.resend.com'),
  RESEND_SMTP_PORT: numberFromEnv(465),
  RESEND_API_KEY: z.string().optional().default(''),
  // SMS / WhatsApp OTP delivery (Twilio REST, no SDK). `disabled` keeps the
  // phone verification endpoints answer 503 instead of silently dropping codes.
  SMS_PROVIDER: z.string().optional().default('disabled'),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_SMS_FROM: z.string().optional().default(''),
  TWILIO_WHATSAPP_FROM: z.string().optional().default(''),
  MAIL_FROM: z.string().default('no-reply@neara.local'),
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(''),
  UPLOAD_MAX_IMAGE_BYTES: numberFromEnv(4194304),
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
  RATE_LIMIT_TENANT_SIGNUP_PER_HOUR: numberFromEnv(20),
  RATE_LIMIT_CLIENT_EVENTS_PER_MINUTE: numberFromEnv(60),
  RATE_LIMIT_MOBILE_AUTH_PER_MINUTE: numberFromEnv(20),
  RATE_LIMIT_MOBILE_REFRESH_PER_MINUTE: numberFromEnv(60),
  RATE_LIMIT_WINDOW_SECONDS: numberFromEnv(60),
  RATE_LIMIT_REQUIRE_SHARED_STORE: booleanFromEnv('false'),
  ALLOW_IN_MEMORY_RATE_LIMIT: booleanFromEnv('false'),
  CUSTOMER_SESSION_COOKIE_NAME: z.string().default('neara.customer.sid'),
  COOKIE_SECURE_INSECURE_DEV: booleanFromEnv('false'),

  // Number of trusted proxies in front of the API. Must match the deployment so
  // Express derives the real client address instead of a spoofed header.
  TRUST_PROXY_HOPS: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? 1 : value === 'false' ? 0 : Number(value)))
    .pipe(z.number().int().min(0).max(10)),

  // Session lifecycle (M-09).
  AUTH_ADMIN_SESSION_ABSOLUTE_HOURS: numberFromEnv(12),
  AUTH_ADMIN_SESSION_IDLE_MINUTES: numberFromEnv(30),
  AUTH_CUSTOMER_SESSION_ABSOLUTE_DAYS: numberFromEnv(7),
  AUTH_CUSTOMER_SESSION_IDLE_HOURS: numberFromEnv(24),
  AUTH_CUSTOMER_TRUSTED_ABSOLUTE_DAYS: numberFromEnv(30),
  AUTH_CUSTOMER_TRUSTED_IDLE_DAYS: numberFromEnv(7),
  AUTH_MAX_ACTIVE_SESSIONS: numberFromEnv(10),
  AUTH_LOCKOUT_THRESHOLD: numberFromEnv(10),
  AUTH_LOCKOUT_MINUTES: numberFromEnv(15),
  AUTH_OTP_MAX_ATTEMPTS: numberFromEnv(5),
  AUTH_OTP_MAX_ACTIVE: numberFromEnv(3),
  AUTH_ACCESS_TOKEN_MINUTES: numberFromEnv(15),
  AUTH_REFRESH_TOKEN_DAYS: numberFromEnv(30),
  AUTH_STEP_UP_MINUTES: numberFromEnv(15),
  AUTH_REQUIRE_PLATFORM_MFA: booleanFromEnv('false'),
  AUTH_REQUIRE_EMAIL_VERIFICATION: booleanFromEnv('false'),
  AUTH_REQUIRE_PHONE_VERIFICATION: booleanFromEnv('false'),
});
