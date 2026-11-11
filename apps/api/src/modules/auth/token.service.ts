import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Token, secret and one-time-password primitives.
 *
 * Access tokens are compact HS256 JWTs signed with SESSION_SECRET. They are
 * short lived and always paired with a server-side session row so they can be
 * revoked immediately (see SessionService).
 */

export type AccessTokenAudience = 'customer' | 'tenant' | 'platform';

export type AccessTokenClaims = {
  typ: 'neara.mobile.access';
  sub: string;
  sid: string;
  aud: AccessTokenAudience;
  did: string;
  iat: number;
  exp: number;
};

const ACCESS_TOKEN_TYPE = 'neara.mobile.access';

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** Cryptographically secure numeric OTP, zero padded to `digits`. */
export function randomNumericCode(digits = 6) {
  const max = 10 ** digits;
  return String(randomInt(0, max)).padStart(digits, '0');
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function signature(data: string, secret: string) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function signAccessToken(claims: Omit<AccessTokenClaims, 'typ'>, secret: string) {
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlJson({ typ: ACCESS_TOKEN_TYPE, ...claims });
  const body = `${header}.${payload}`;
  return `${body}.${signature(body, secret)}`;
}

export function verifyAccessToken(token: string, secret: string): AccessTokenClaims | null {
  if (typeof token !== 'string' || token.length > 4096) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, providedSignature] = parts;
  const expectedSignature = signature(`${header}.${payload}`, secret);
  const provided = Buffer.from(providedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed.typ !== ACCESS_TOKEN_TYPE) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = Number(parsed.exp);
  const iat = Number(parsed.iat);
  if (!Number.isFinite(exp) || !Number.isFinite(iat) || exp <= nowSeconds || iat > nowSeconds + 60) {
    return null;
  }

  if (
    typeof parsed.sub !== 'string' ||
    typeof parsed.sid !== 'string' ||
    typeof parsed.did !== 'string' ||
    (parsed.aud !== 'customer' && parsed.aud !== 'tenant' && parsed.aud !== 'platform')
  ) {
    return null;
  }

  return {
    typ: ACCESS_TOKEN_TYPE,
    sub: parsed.sub,
    sid: parsed.sid,
    aud: parsed.aud,
    did: parsed.did,
    iat,
    exp,
  };
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20) {
  const buffer = randomBytes(bytes);
  let output = '';
  let bits = 0;
  let value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(secret: string) {
  const normalized = secret.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) {
      continue;
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** RFC 6238 TOTP (SHA1, 6 digits, 30 second step). */
export function totpCode(secret: string, timestampMs = Date.now()) {
  const counter = Math.floor(timestampMs / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter % 2 ** 32, 4);
  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

/** Accepts the current 30s step plus one step of clock drift each way. */
export function verifyTotp(secret: string, code: string, timestampMs = Date.now()) {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }
  for (const drift of [-1, 0, 1]) {
    const candidate = totpCode(secret, timestampMs + drift * 30_000);
    const left = Buffer.from(candidate);
    const right = Buffer.from(normalized);
    if (left.length === right.length && timingSafeEqual(left, right)) {
      return true;
    }
  }
  return false;
}

function secretKey(secret: string) {
  return scryptSync(secret, 'neara.mfa.v1', 32);
}

/** AES-256-GCM encryption for TOTP seeds stored at rest. */
export function encryptSecret(plaintext: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptSecret(ciphertext: string, secret: string) {
  const [ivPart, dataPart, tagPart] = ciphertext.split('.');
  if (!ivPart || !dataPart || !tagPart) {
    return null;
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', secretKey(secret), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Short, unequivocal failure tokens for logs and audit rows. */
export function opaqueFingerprint(value: string, secret: string) {
  return hashToken(`${secret}:${value}`).slice(0, 16);
}
