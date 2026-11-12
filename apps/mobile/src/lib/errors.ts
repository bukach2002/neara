import { ApiError } from './http';

export function messageFor(error: unknown, fallback = 'Something went wrong. Try again.') {
  if (error instanceof ApiError) {
    return error.safeMessage;
  }
  return fallback;
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
