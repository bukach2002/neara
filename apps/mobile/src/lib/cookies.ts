import { parseHttpUrl } from './urls';

/**
 * Minimal, dependency-free cookie jar so native requests can keep the API's
 * httpOnly session cookies without relying on platform fetch cookie handling.
 *
 * The jar is persisted by session-store.ts in expo-secure-store. These functions
 * are pure so the parsing rules stay easy to audit.
 *
 * Scope: cookies are host-only (the API never sets Domain) and path/expiry aware.
 */

export type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expiresAt: number | null;
  secure: boolean;
  httpOnly: boolean;
};

const COOKIE_ATTR_SPLIT = /;(?=(?:[^"]*"[^"]*")*[^"]*$)/;

/**
 * React Native may deliver all Set-Cookie headers joined with ", ".
 * Split them without breaking the "Wed, 21 Oct 2015 07:28:00 GMT" date form,
 * which is the only legitimate comma in a Set-Cookie header.
 */
export function splitSetCookieHeader(header: string): string[] {
  const parts: string[] = [];
  let start = 0;

  for (let index = 0; index < header.length; index += 1) {
    if (header[index] !== ',') {
      continue;
    }

    const rest = header.slice(index + 1).replace(/^\s+/, '');
    const nextSegment = rest.split(';')[0] ?? '';
    const equalsIndex = nextSegment.indexOf('=');
    // A new cookie starts with "name=value". Date segments ("21 Oct 2025 ...")
    // contain no "=" before the first ";", so they stay in the current cookie.
    const looksLikeCookieStart = equalsIndex > 0 && /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(nextSegment.slice(0, equalsIndex));

    if (looksLikeCookieStart) {
      parts.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(header.slice(start).trim());
  return parts.filter((part) => part.length > 0);
}

export function parseSetCookie(header: string, requestUrl: string): StoredCookie | null {
  const request = parseHttpUrl(requestUrl);
  const segments = header.split(COOKIE_ATTR_SPLIT);
  const pair = segments.shift()?.trim() ?? '';
  const equalsIndex = pair.indexOf('=');

  if (equalsIndex <= 0) {
    return null;
  }

  const name = pair.slice(0, equalsIndex).trim();
  const rawValue = pair.slice(equalsIndex + 1).trim();
  if (!name) {
    return null;
  }

  let value = rawValue;
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  }

  let path = '/';
  let expiresAt: number | null = null;
  let secure = false;
  let httpOnly = false;

  for (const rawAttribute of segments) {
    const attribute = rawAttribute.trim();
    if (!attribute) {
      continue;
    }
    const separator = attribute.indexOf('=');
    const key = (separator === -1 ? attribute : attribute.slice(0, separator)).trim().toLowerCase();
    const attributeValue = separator === -1 ? '' : attribute.slice(separator + 1).trim();

    switch (key) {
      case 'path':
        path = attributeValue.startsWith('/') ? attributeValue : '/';
        break;
      case 'expires': {
        const parsed = Date.parse(attributeValue);
        if (!Number.isNaN(parsed)) {
          expiresAt = parsed;
        }
        break;
      }
      case 'max-age': {
        const seconds = Number.parseInt(attributeValue, 10);
        if (Number.isFinite(seconds)) {
          expiresAt = Date.now() + seconds * 1000;
        }
        break;
      }
      case 'secure':
        secure = true;
        break;
      case 'httponly':
        httpOnly = true;
        break;
      default:
        break;
    }
  }

  return {
    name,
    value,
    domain: request.hostname.toLowerCase(),
    path,
    expiresAt,
    secure,
    httpOnly,
  };
}

export function isCookieExpired(cookie: StoredCookie, now = Date.now()) {
  return cookie.expiresAt !== null && cookie.expiresAt <= now;
}

export function pathMatches(cookiePath: string, requestPath: string) {
  if (cookiePath === '/') {
    return true;
  }
  if (requestPath === cookiePath) {
    return true;
  }
  return requestPath.startsWith(cookiePath.endsWith('/') ? cookiePath : `${cookiePath}/`);
}

export function cookiesForUrl(cookies: StoredCookie[], url: string, now = Date.now()) {
  const request = parseHttpUrl(url);

  return cookies.filter(
    (cookie) =>
      cookie.domain === request.hostname &&
      pathMatches(cookie.path, request.pathname) &&
      !isCookieExpired(cookie, now) &&
      (!cookie.secure || request.protocol === 'https:'),
  );
}

export function cookieHeaderForUrl(cookies: StoredCookie[], url: string, now = Date.now()) {
  return cookiesForUrl(cookies, url, now)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export function findCookieValue(cookies: StoredCookie[], name: string, now = Date.now()) {
  const match = cookies.find((cookie) => cookie.name === name && !isCookieExpired(cookie, now));
  return match?.value;
}

/**
 * Merge Set-Cookie values into the jar. Deletions (expired / Max-Age=0) remove
 * the matching cookie instead of storing it.
 */
export function mergeSetCookies(
  current: StoredCookie[],
  setCookieHeaders: string[],
  requestUrl: string,
  now = Date.now(),
): StoredCookie[] {
  const next = current.filter((cookie) => !isCookieExpired(cookie, now));

  for (const header of setCookieHeaders) {
    const parsed = parseSetCookie(header, requestUrl);
    if (!parsed) {
      continue;
    }

    const existingIndex = next.findIndex(
      (cookie) => cookie.name === parsed.name && cookie.domain === parsed.domain && cookie.path === parsed.path,
    );
    if (existingIndex >= 0) {
      next.splice(existingIndex, 1);
    }

    if (!isCookieExpired(parsed, now)) {
      next.push(parsed);
    }
  }

  return next;
}

export function readSetCookieHeaders(headers: Headers): string[] {
  // Newer runtimes expose the individual headers; older RN joins them.
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    const values = withGetSetCookie.getSetCookie();
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
  }

  const joined = headers.get('set-cookie');
  return joined ? splitSetCookieHeader(joined) : [];
}
