import { BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Shared security primitives.
 *
 * Everything here is deliberately dependency free and pure so it can be unit
 * tested and reused by both the cookie (web) and bearer (mobile) auth surfaces.
 */

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercase and trim an email address. Returns undefined for blank input. */
export function normalizeEmail(email?: string | null) {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || undefined;
}

/**
 * Normalise a phone number to E.164 so that "+91 98765 43210", "0091 98765 43210"
 * and "+919876543210" resolve to the same identity at write and read time.
 *
 * The launch market is India, so a bare 10 digit number is treated as +91.
 * Returns undefined when the value cannot be normalised.
 */
export function normalizePhone(phone?: string | null) {
  const raw = phone?.trim();
  if (!raw) {
    return undefined;
  }

  let candidate = raw.replace(/[\s().-]/g, '');
  if (candidate.startsWith('00')) {
    candidate = `+${candidate.slice(2)}`;
  }
  if (!candidate.startsWith('+')) {
    if (/^\d{10}$/.test(candidate)) {
      candidate = `+91${candidate}`;
    } else if (/^\d{11,15}$/.test(candidate) && !candidate.startsWith('0')) {
      candidate = `+${candidate}`;
    }
  }

  return PHONE_PATTERN.test(candidate) ? candidate : undefined;
}

export function normalizeEmailOrUndefined(email?: string | null) {
  const normalized = normalizeEmail(email);
  return normalized && EMAIL_PATTERN.test(normalized) ? normalized : undefined;
}

/** "a•••@example.com" — never returns the full local part. */
export function maskEmail(email?: string | null) {
  if (!email) {
    return null;
  }
  const [local, domain] = email.split('@');
  if (!domain) {
    return '•••';
  }
  const visible = local.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(3, Math.min(local.length - 1, 6)))}@${domain}`;
}

/** "+91••••••3210" — keeps only the country code and last four digits. */
export function maskPhone(phone?: string | null) {
  if (!phone) {
    return null;
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '•'.repeat(digits.length);
  }
  const country = phone.startsWith('+') ? `+${digits.slice(0, Math.min(2, digits.length - 4))}` : '';
  return `${country}${'•'.repeat(Math.max(3, digits.length - country.length - 4))}${digits.slice(-4)}`;
}

/** "R•••a" — keeps an initial and final letter for human confirmation. */
export function maskName(name?: string | null) {
  if (!name) {
    return null;
  }
  const trimmed = name.trim();
  if (trimmed.length <= 2) {
    return '•'.repeat(trimmed.length);
  }
  return `${trimmed.slice(0, 1)}${'•'.repeat(Math.max(2, trimmed.length - 2))}${trimmed.slice(-1)}`;
}

/** Constant time comparison of two hex digests. Never throws on length mismatch. */
export function constantTimeEquals(left: string, right: string) {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return false;
  }
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Keyed hash for rate-limit keys and audit trails. Raw IPs, emails and phone
 * numbers are never written to logs or limiter keys in recoverable form.
 */
export function hashIdentifier(secret: string, value: string) {
  return createHmac('sha256', secret).update(value.trim().toLowerCase()).digest('hex').slice(0, 32);
}

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'password1234',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'letmein1',
  'iloveyou1',
  'welcome1',
  'welcome123',
  'admin123',
  'admin1234',
  'administrator',
  'changeme',
  'changeme1',
  'changeme123',
  'changeme123!',
  'test1234',
  'test12345',
  'abcd1234',
  'abc12345',
  'aa123456',
  'football1',
  'baseball1',
  'sunshine1',
  'princess1',
  'neara1234',
  'nearane123',
  'local-session-secret-change-me',
]);

/**
 * Rejects trivially guessable passwords. Combined with lockout and per-account
 * rate limits this removes the seeded/default credential class of attack.
 */
export function assertStrongPassword(password: string, context: { email?: string | null; name?: string | null } = {}) {
  const value = password ?? '';
  const lower = value.toLowerCase();

  if (value.length < 8) {
    throw new BadRequestException('Choose a password with at least 8 characters');
  }

  if (COMMON_PASSWORDS.has(lower)) {
    throw new BadRequestException('That password is too common. Choose something unique.');
  }

  if (/^(.)\1{7,}$/.test(value)) {
    throw new BadRequestException('That password is too easy to guess. Choose something unique.');
  }

  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    throw new BadRequestException('Use at least one letter and one number in your password');
  }

  const localPart = context.email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
    throw new BadRequestException('Do not use your email address as your password');
  }

  const normalizedName = context.name?.toLowerCase().replace(/\s+/g, '');
  if (normalizedName && normalizedName.length >= 5 && lower.includes(normalizedName)) {
    throw new BadRequestException('Do not use your name as your password');
  }
}

/**
 * Baseline security headers for the API. These are applied to every response,
 * including errors, so proxies and clients cannot downgrade transport or cache
 * authenticated payloads.
 */
export function securityHeaders(options: { production: boolean }) {
  return (_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('cross-origin-opener-policy', 'same-origin');
    response.setHeader('cross-origin-resource-policy', 'same-site');
    response.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    response.setHeader('x-permitted-cross-domain-policies', 'none');

    if (options.production) {
      response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
  };
}

/** Marks a response as never cacheable. Required for every auth/session response. */
export function noStore(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('cache-control', 'no-store, no-cache, must-revalidate, private');
  response.setHeader('pragma', 'no-cache');
  response.setHeader('expires', '0');
  next();
}

/**
 * Recursively removes direct identifiers from a JSON payload (audit snapshots,
 * notification payloads) while keeping operational fields intact.
 */
export function redactPiiJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactPiiJson(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase();
    if (normalized.includes('email') || normalized.includes('phone') || normalized === 'recipient') {
      redacted[key] = null;
    } else if (normalized.includes('customer') && normalized.includes('name')) {
      redacted[key] = 'Redacted';
    } else if (normalized === 'name' || normalized === 'customername') {
      redacted[key] = 'Redacted';
    } else if (normalized.includes('note')) {
      redacted[key] = null;
    } else {
      redacted[key] = redactPiiJson(nestedValue);
    }
  }
  return redacted;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isUnsafeMethod(method: string) {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Reject duplicate or oversized cookie headers. Duplicate names are ambiguous
 * and are a classic cookie-shadowing primitive.
 */
export function hasAmbiguousCookieHeader(request: Request) {
  const header = request.headers.cookie;
  if (!header) {
    return false;
  }
  if (header.length > 8192) {
    return true;
  }

  const names = new Set<string>();
  for (const pair of header.split(';')) {
    const trimmed = pair.trim();
    const separator = trimmed.indexOf('=');
    const name = separator > 0 ? trimmed.slice(0, separator) : undefined;
    if (!name) {
      continue;
    }
    if (names.has(name) || trimmed.length - separator - 1 > 4096) {
      return true;
    }
    names.add(name);
  }

  return false;
}
