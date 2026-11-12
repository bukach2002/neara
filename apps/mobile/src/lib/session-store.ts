import { deleteSecure, readSecureJson, writeSecureJson } from './secure-storage';

/**
 * Bearer-token session store.
 *
 * Tokens live in the OS keychain/keystore. Nothing here is ever logged, and the
 * device identifier is a stable, non-secret handle used to bind the refresh
 * family to this installation.
 */
export type SessionTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  deviceId: string;
};

const TOKENS_KEY = 'neara.session.tokens.v1';
const DEVICE_KEY = 'neara.device.id.v1';
const ACCESS_SKEW_MS = 30_000;

let cachedTokens: SessionTokens | null | undefined;
let writeQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isUsable(isoTimestamp: string | undefined, now = Date.now()) {
  const timestamp = isoTimestamp ? Date.parse(isoTimestamp) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > now;
}

async function ensureLoaded() {
  if (cachedTokens !== undefined) {
    return cachedTokens;
  }
  const stored = await readSecureJson<SessionTokens>(TOKENS_KEY);
  cachedTokens = stored && typeof stored.refreshToken === 'string' ? stored : null;
  return cachedTokens;
}

export async function readSessionTokens() {
  const tokens = await ensureLoaded();
  if (!tokens) {
    return null;
  }
  if (!isUsable(tokens.refreshTokenExpiresAt)) {
    await clearSession();
    return null;
  }
  return tokens;
}

export async function writeSessionTokens(tokens: SessionTokens) {
  return serialize(async () => {
    cachedTokens = tokens;
    await writeSecureJson(TOKENS_KEY, tokens);
  });
}

export async function clearSession() {
  return serialize(async () => {
    cachedTokens = null;
    await deleteSecure(TOKENS_KEY);
  });
}

/** A short-lived access token, or null when it is missing or about to expire. */
export async function getAccessToken() {
  const tokens = await ensureLoaded();
  if (!tokens || !isUsable(tokens.accessTokenExpiresAt, Date.now() + ACCESS_SKEW_MS)) {
    return null;
  }
  return tokens.accessToken;
}

/** True while a refresh token exists that has not expired. */
export async function hasSession() {
  const tokens = await readSessionTokens();
  return Boolean(tokens?.refreshToken);
}

/**
 * Stable per-install device id. Not a secret: it binds a refresh family to this
 * device so a copied token cannot be replayed from somewhere else.
 */
export async function getDeviceId() {
  const existing = await readSecureJson<string>(DEVICE_KEY);
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }

  const deviceId = `dvc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await writeSecureJson(DEVICE_KEY, deviceId);
  return deviceId;
}
