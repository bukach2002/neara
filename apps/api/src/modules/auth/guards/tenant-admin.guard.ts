import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { AUTH_CONTEXT_REQUEST_KEY } from '../types';

@Injectable()
export class TenantAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = typeof request.params?.tenantId === 'string' ? request.params.tenantId : undefined;
    const authContext = await this.authService.requireTenantAdmin(request, tenantId);
    request[AUTH_CONTEXT_REQUEST_KEY] = authContext;
    return true;
  }
}
