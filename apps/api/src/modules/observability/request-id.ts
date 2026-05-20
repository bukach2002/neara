import type { Request } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdFrom(request: Request) {
  return request.requestId ?? request.header(REQUEST_ID_HEADER) ?? undefined;
}

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}
