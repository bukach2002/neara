import { Platform } from 'react-native';
import { originOf } from './urls';

const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
const FALLBACK_DEV_URL = Platform.select({
  android: 'http://10.0.2.2:4000',
  ios: 'http://localhost:4000',
  default: 'http://localhost:4000',
});

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl() {
  if (RAW_API_URL.length > 0) {
    return normalizeBaseUrl(RAW_API_URL);
  }
  // __DEV__ is inlined by Metro. Production builds must be explicit.
  if (__DEV__) {
    return FALLBACK_DEV_URL;
  }
  throw new Error('EXPO_PUBLIC_API_URL is required for production builds');
}

export const API_URL = resolveApiUrl();

if (!__DEV__ && !API_URL.startsWith('https://')) {
  // Fail closed: session cookies must never travel over plain HTTP in release builds.
  throw new Error('EXPO_PUBLIC_API_URL must use https:// in production builds');
}

export const API_ORIGIN = originOf(API_URL);
export const REQUEST_TIMEOUT_MS = 20_000;
export const APP_VERSION = '0.1.0';
