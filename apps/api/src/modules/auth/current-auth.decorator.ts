import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_CONTEXT_REQUEST_KEY, AuthContext } from './types';

export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthContext | undefined => {
  const request = context.switchToHttp().getRequest<Request>();
  return request[AUTH_CONTEXT_REQUEST_KEY];
});
