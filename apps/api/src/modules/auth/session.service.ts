import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole, SessionAudience, TenantRole, UserStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CsrfService } from './csrf.service';
import { hashToken, randomToken } from './token.service';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export type SessionAudienceName = 'admin' | 'customer';

export type SessionPolicy = {
  absoluteMs: number;
  idleMs: number;
};

export type CookieSessionUser = {
  id: string;
  email: string | null;
  mobileNumber: string | null;
  name: string;
  platformRole: PlatformRole;
  mfaEnabledAt: Date | null;
  emailVerifiedAt: Date | null;
  mobileVerifiedAt: Date | null;
  status: UserStatus;
  memberships: Array<{
    tenantId: string;
    role: TenantRole;
    tenant: { id: string; name: string; slug: string; status: string };
  }>;
};

const LAST_USED_TOUCH_MS = 5 * MINUTE_MS;
const DEFAULT_MAX_SESSIONS = 10;

/**
 * Owns cookie session lifecycle for the web surface: creation, idle and
 * absolute expiry, per-device revocation and CSRF cookie pairing.
 *
 * Native clients use MobileAuthService (bearer tokens) instead, but both share
 * the same Session table so revocation is immediate on every surface.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly csrf: CsrfService,
  ) {}

  policyFor(audience: SessionAudienceName, trustedDevice = false): SessionPolicy {
    if (audience === 'admin') {
      return {
        absoluteMs: this.config.get<number>('AUTH_ADMIN_SESSION_ABSOLUTE_HOURS', 12) * HOUR_MS,
        idleMs: this.config.get<number>('AUTH_ADMIN_SESSION_IDLE_MINUTES', 30) * MINUTE_MS,
      };
    }

    if (trustedDevice) {
      return {
        absoluteMs: this.config.get<number>('AUTH_CUSTOMER_TRUSTED_ABSOLUTE_DAYS', 30) * 24 * HOUR_MS,
        idleMs: this.config.get<number>('AUTH_CUSTOMER_TRUSTED_IDLE_DAYS', 7) * 24 * HOUR_MS,
      };
    }

    return {
      absoluteMs: this.config.get<number>('AUTH_CUSTOMER_SESSION_ABSOLUTE_DAYS', 7) * 24 * HOUR_MS,
      idleMs: this.config.get<number>('AUTH_CUSTOMER_SESSION_IDLE_HOURS', 24) * HOUR_MS,
    };
  }

  async createCookieSession(input: {
    userId: string;
    audience: SessionAudienceName;
    response: Response;
    trustedDevice?: boolean;
    device?: { id?: string; name?: string; platform?: string };
  }) {
    const policy = this.policyFor(input.audience, input.trustedDevice);
    const now = Date.now();
    const expiresAt = new Date(now + policy.absoluteMs);
    const token = randomToken();

    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash: hashToken(token),
        audience: input.audience === 'admin' ? SessionAudience.admin : SessionAudience.customer,
        trustedDevice: Boolean(input.trustedDevice),
        deviceId: input.device?.id?.slice(0, 128),
        deviceName: input.device?.name?.slice(0, 120),
        platform: input.device?.platform?.slice(0, 40),
        lastUsedAt: new Date(),
        expiresAt,
        absoluteExpiresAt: expiresAt,
      },
    });

    await this.enforceSessionCap(input.userId, input.audience === 'admin' ? SessionAudience.admin : SessionAudience.customer);

    const csrfToken = this.csrf.createToken(token);
    this.writeSessionCookie(input.response, input.audience, token, expiresAt);
    this.writeCsrfCookie(input.response, csrfToken, expiresAt);

    return { session, token, csrfToken, expiresAt, idleExpiresAt: new Date(now + policy.idleMs) };
  }

  /**
   * Resolves a cookie session, enforcing revocation, absolute expiry, idle
   * expiry and account status. `requireCsrf` also validates the double-submit
   * token and the browser origin signals.
   */
  async requireSession(
    request: Request,
    audience: SessionAudienceName,
    options: { requireCsrf?: boolean; allowedOrigins?: string[] } = {},
  ): Promise<{ sessionId: string; userId: string; createdAt: Date; user: CookieSessionUser }> {
    const cookieName = this.sessionCookieName(audience);
    const token = this.readCookie(request, cookieName);
    if (!token) {
      throw new UnauthorizedException(audience === 'admin' ? 'Admin session is required' : 'Customer session is required');
    }

    if (options.requireCsrf) {
      this.csrf.verifyRequest(request, token);
      this.csrf.verifyOrigin(request, options.allowedOrigins);
    }

    const sessionAudience = audience === 'admin' ? SessionAudience.admin : SessionAudience.customer;
    const session = await this.prisma.session.findFirst({
      where: { tokenHash: hashToken(token), audience: sessionAudience },
      include: { user: { include: { memberships: { include: { tenant: true } } } } },
    });

    if (!session || session.revokedAt || session.user.status !== UserStatus.active) {
      throw new UnauthorizedException(audience === 'admin' ? 'Admin session is invalid or expired' : 'Customer session is invalid or expired');
    }

    const now = Date.now();
    const policy = this.policyFor(audience, session.trustedDevice);
    const absoluteExpiry = (session.absoluteExpiresAt ?? session.expiresAt).getTime();
    const idleExpiry = (session.lastUsedAt ?? session.createdAt).getTime() + policy.idleMs;

    if (absoluteExpiry <= now || idleExpiry <= now || session.expiresAt.getTime() <= now) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException(audience === 'admin' ? 'Admin session is invalid or expired' : 'Customer session is invalid or expired');
    }

    if (!session.lastUsedAt || now - session.lastUsedAt.getTime() > LAST_USED_TOUCH_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        mobileNumber: session.user.mobileNumber,
        name: session.user.name,
        platformRole: session.user.platformRole,
        mfaEnabledAt: session.user.mfaEnabledAt,
        emailVerifiedAt: session.user.emailVerifiedAt,
        mobileVerifiedAt: session.user.mobileVerifiedAt,
        status: session.user.status,
        memberships: session.user.memberships.map((membership) => ({
          tenantId: membership.tenantId,
          role: membership.role,
          tenant: {
            id: membership.tenant.id,
            name: membership.tenant.name,
            slug: membership.tenant.slug,
            status: membership.tenant.status,
          },
        })),
      },
    };
  }

  async revokeSession(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByToken(token: string, audience?: SessionAudienceName) {
    await this.prisma.session.updateMany({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
        ...(audience ? { audience: audience === 'admin' ? SessionAudience.admin : SessionAudience.customer } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke every session for a user. Called on password reset, email/phone
   * change, membership or role change, tenant suspension and account erasure.
   */
  async revokeAllForUser(userId: string, audience?: SessionAudienceName) {
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({
        where: {
          userId,
          ...(audience ? { audience: audience === 'admin' ? SessionAudience.admin : SessionAudience.customer } : {}),
        },
      }),
      this.prisma.mobileRefreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async revokeForTenantMembers(tenantId: string) {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId },
      select: { userId: true },
    });

    for (const membership of memberships) {
      await this.revokeAllForUser(membership.userId);
    }
  }

  async listForUser(userId: string) {
    const [sessions, mobileTokens] = await Promise.all([
      this.prisma.session.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          audience: true,
          deviceId: true,
          deviceName: true,
          platform: true,
          trustedDevice: true,
          lastUsedAt: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
      this.prisma.mobileRefreshToken.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          familyId: true,
          deviceId: true,
          deviceName: true,
          platform: true,
          lastUsedAt: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
    ]);

    const mobileFamilies = new Map<string, (typeof mobileTokens)[number]>();
    for (const token of mobileTokens) {
      if (!mobileFamilies.has(token.familyId)) {
        mobileFamilies.set(token.familyId, token);
      }
    }

    return [
      ...sessions.map((session) => ({
        id: session.id,
        kind: 'web' as const,
        audience: session.audience,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        platform: session.platform,
        trustedDevice: session.trustedDevice,
        lastUsedAt: session.lastUsedAt,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      })),
      ...[...mobileFamilies.values()].map((token) => ({
        id: token.familyId,
        kind: 'mobile' as const,
        audience: null,
        deviceId: token.deviceId,
        deviceName: token.deviceName,
        platform: token.platform,
        trustedDevice: true,
        lastUsedAt: token.lastUsedAt,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
      })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async revokeListedSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (session) {
      await this.revokeSession(session.id);
      return true;
    }

    const mobileToken = await this.prisma.mobileRefreshToken.findFirst({ where: { familyId: sessionId, userId } });
    if (mobileToken) {
      await this.prisma.mobileRefreshToken.updateMany({
        where: { familyId: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return true;
    }

    return false;
  }

  sessionCookieName(audience: SessionAudienceName) {
    const base =
      audience === 'admin'
        ? this.config.get<string>('SESSION_COOKIE_NAME', 'neara.sid')
        : this.config.get<string>('CUSTOMER_SESSION_COOKIE_NAME', 'neara.customer.sid');
    return this.applyHostPrefix(base);
  }

  clearCookies(response: Response, audience: SessionAudienceName) {
    const cookieName = this.sessionCookieName(audience);
    response.clearCookie(cookieName, this.baseCookieOptions(audience));
    response.clearCookie(this.csrf.cookieName(), this.baseCookieOptions(audience, false));
  }

  readCookie(request: Request, name: string) {
    const header = request.headers.cookie;
    if (!header) {
      return undefined;
    }

    const matches = header
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

  private writeSessionCookie(response: Response, audience: SessionAudienceName, token: string, expiresAt: Date) {
    response.cookie(this.sessionCookieName(audience), token, {
      ...this.baseCookieOptions(audience),
      expires: expiresAt,
    });
  }

  private writeCsrfCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie(this.csrf.cookieName(), token, {
      ...this.baseCookieOptions('admin', false),
      expires: expiresAt,
    });
  }

  private baseCookieOptions(audience: SessionAudienceName, httpOnly = true) {
    return {
      httpOnly,
      secure: this.useSecureCookies(),
      sameSite: audience === 'admin' ? ('strict' as const) : ('lax' as const),
      path: '/',
    };
  }

  private useSecureCookies() {
    const environment = this.config.get<string>('NODE_ENV', 'development');
    if (environment === 'production' || environment === 'staging') {
      return true;
    }
    return this.config.get<string>('COOKIE_SECURE_INSECURE_DEV', 'false') === 'true';
  }

  private applyHostPrefix(name: string) {
    if (!this.useSecureCookies()) {
      return name;
    }
    return name.startsWith('__Host-') ? name : `__Host-${name}`;
  }

  private async enforceSessionCap(userId: string, audience: SessionAudience) {
    const cap = this.config.get<number>('AUTH_MAX_ACTIVE_SESSIONS', DEFAULT_MAX_SESSIONS);
    const sessions = await this.prisma.session.findMany({
      where: { userId, audience, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (sessions.length <= cap) {
      return;
    }

    const stale = sessions.slice(cap).map((session) => session.id);
    await this.prisma.session.updateMany({
      where: { id: { in: stale } },
      data: { revokedAt: new Date() },
    });
  }
}
