import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { AUTH_CONTEXT_REQUEST_KEY } from '../types';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const authContext = await this.authService.requirePlatformAdmin(request);
    request[AUTH_CONTEXT_REQUEST_KEY] = authContext;
    return true;
  }
}
