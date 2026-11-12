import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import type { Request } from 'express';
import { constantTimeEquals } from '../../support/security';

/**
 * Double-submit CSRF protection for cookie-authenticated mutations, plus the
 * Origin / Sec-Fetch-Site checks browsers provide for free.
 *
 * Native clients replay the readable XSRF cookie as the `x-csrf-token` header,
 * so they satisfy exactly the same contract as the web app.
 */
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

    if (!headerToken || !cookieToken || !constantTimeEquals(headerToken, cookieToken) || !constantTimeEquals(headerToken, expectedToken)) {
      throw new ForbiddenException('Valid CSRF token is required');
    }
  }

  /**
   * Rejects cross-site cookie traffic when the browser tells us the request is
   * cross-site. Native requests send no Origin/Sec-Fetch-Site and are still
   * bound by the CSRF token above.
   */
  verifyOrigin(request: Request, allowedOrigins?: string[]) {
    const fetchSite = request.header('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
      throw new ForbiddenException('Cross-site request rejected');
    }

    const origin = request.header('origin');
    if (!origin) {
      return;
    }

    const allowed = (allowedOrigins ?? this.defaultOrigins()).map((value) => value.trim().replace(/\/$/, '')).filter(Boolean);
    if (origin === 'null') {
      throw new ForbiddenException('Cross-site request rejected');
    }
    if (!allowed.includes(origin.replace(/\/$/, ''))) {
      throw new ForbiddenException('Origin not allowed');
    }
  }

  private defaultOrigins() {
    const webAppUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:3000');
    const extra = this.config.get<string>('CORS_ALLOWED_ORIGINS', '');
    return [webAppUrl, ...extra.split(',')];
  }

  private secret() {
    return this.config.get<string>('CSRF_SECRET', 'local-csrf-secret-change-me');
  }

  private getCookie(request: Request, name: string) {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return undefined;
    }

    const matches = cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .filter((cookie) => cookie.startsWith(`${name}=`));

    if (matches.length !== 1) {
      return undefined;
    }

    try {
      return decodeURIComponent(matches[0].slice(name.length + 1));
    } catch {
      return undefined;
    }
  }
}
