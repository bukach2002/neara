import {
  cookieHeaderForUrl,
  findCookieValue,
  mergeSetCookies,
  readSetCookieHeaders,
  type StoredCookie,
} from './cookies';
import { deleteSecure, readSecureJson, writeSecureJson } from './secure-storage';

/**
 * Session cookie jar.
 *
 * The API issues httpOnly session cookies plus a readable XSRF cookie. Native
 * clients cannot rely on browser cookie persistence, so the jar is stored in the
 * OS keychain/keystore and replayed explicitly. Nothing here is ever logged.
 */
const STORAGE_KEY = 'neara.session.cookies.v1';

let jar: StoredCookie[] | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function ensureLoaded() {
  if (jar !== null) {
    return jar;
  }
  const stored = await readSecureJson<StoredCookie[]>(STORAGE_KEY);
  jar = Array.isArray(stored) ? stored : [];
  return jar;
}

export async function getCookieHeader(url: string) {
  const cookies = await ensureLoaded();
  return cookieHeaderForUrl(cookies, url);
}

export async function getCookieValue(name: string) {
  const cookies = await ensureLoaded();
  return findCookieValue(cookies, name);
}

/** Persist cookies from a response. Returns false when the response set none. */
export async function captureResponseCookies(response: Response, requestUrl: string) {
  const setCookieHeaders = readSetCookieHeaders(response.headers);
  if (setCookieHeaders.length === 0) {
    return false;
  }

  return serialize(async () => {
    const current = await ensureLoaded();
    const next = mergeSetCookies(current, setCookieHeaders, requestUrl);
    jar = next;
    await writeSecureJson(STORAGE_KEY, next);
    return true;
  });
}

export async function hasSessionCookies() {
  const cookies = await ensureLoaded();
  return cookies.length > 0;
}

export function clearSession() {
  return serialize(async () => {
    jar = [];
    await deleteSecure(STORAGE_KEY);
  });
}
