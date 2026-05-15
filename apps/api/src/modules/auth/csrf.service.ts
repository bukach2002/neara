import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class CsrfService {
  constructor(private readonly config: ConfigService) {}

  cookieName() {
    return 'XSRF-TOKEN';
  }

  headerName() {
    return 'x-csrf-token';
  }

  createToken(sessionToken: string) {
    return createHmac('sha256', this.secret()).update(sessionToken).digest('base64url');
  }

  verifyRequest(request: Request, sessionToken: string) {
    const headerToken = request.header(this.headerName());
    const cookieToken = this.getCookie(request, this.cookieName());
    const expectedToken = this.createToken(sessionToken);

    if (!headerToken || !cookieToken || headerToken !== cookieToken || headerToken !== expectedToken) {
      throw new ForbiddenException('Valid CSRF token is required');
    }
  }

  private secret() {
    return this.config.get<string>('CSRF_SECRET', 'local-csrf-secret-change-me');
  }

  private getCookie(request: Request, name: string) {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return undefined;
    }

    const cookies = cookieHeader.split(';').map((cookie: string) => cookie.trim());
    const match = cookies.find((cookie: string) => cookie.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
  }
}
