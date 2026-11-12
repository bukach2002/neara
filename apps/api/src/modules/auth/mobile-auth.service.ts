import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole, Prisma, SessionAudience, TenantRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertStrongPassword, normalizeEmail, normalizePhone } from '../../support/security';
import {
  MobileLoginDto,
  MobilePasswordResetConfirmDto,
  MobilePasswordResetRequestDto,
  MobileRefreshDto,
} from './dto/mobile-auth.dto';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import type { AccessTokenAudience } from './token.service';
import { decryptSecret, hashToken, randomToken, signAccessToken, verifyAccessToken, verifyTotp } from './token.service';
import type { AuthContext, AuthenticatedUser } from './types';

type ResolvedRole = 'platform_admin' | 'tenant_admin' | 'customer';

const GENERIC_CREDENTIALS = 'Invalid identifier or password';
const GENERIC_REFRESH = 'Your session has expired. Sign in again.';

const ROLE_AUDIENCE: Record<ResolvedRole, AccessTokenAudience> = {
  platform_admin: 'platform',
  tenant_admin: 'tenant',
  customer: 'customer',
};

const ROLE_SESSION_AUDIENCE: Record<ResolvedRole, SessionAudience> = {
  platform_admin: SessionAudience.admin,
  tenant_admin: SessionAudience.admin,
  customer: SessionAudience.customer,
};

const UNKNOWN_ACCOUNT_HASH = bcrypt.hashSync(randomToken(16), 10);

/**
 * Bearer-token auth surface for native clients.
 *
 * - one password verification resolves the role server-side
 * - access tokens are short lived (AUTH_ACCESS_TOKEN_MINUTES) HS256 JWTs bound
 *   to a device and a refresh family
 * - refresh tokens rotate on every use, are hashed at rest, and reuse revokes
 *   the whole family
 * - revocation is immediate because every bearer call checks its family row
 */
@Injectable()
export class MobileAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async login(dto: MobileLoginDto, request: Request) {
    const user = await this.findUserByIdentifier(dto.identifier);

    if (!user) {
      await bcrypt.compare(dto.password, UNKNOWN_ACCOUNT_HASH);
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordFailedAttempt(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    if (user.status !== UserStatus.active) {
      // Reached only after the password matched, so this is not an enumeration oracle.
      throw new ForbiddenException('This account cannot be used to sign in here');
    }

    const role = this.resolveRole(user);
    if (!role) {
      await this.recordFailedAttempt(user.id, user.failedLoginAttempts);
      // Generic: never disclose whether the account exists or which role it has.
      throw new ForbiddenException('This account cannot be used to sign in here');
    }

    if (user.mfaEnabledAt) {
      const secret = user.mfaSecretCiphertext
        ? decryptSecret(user.mfaSecretCiphertext, this.config.get<string>('SESSION_SECRET', 'local-session-secret-change-me'))
        : null;
      if (!secret) {
        throw new ForbiddenException('Multi-factor authentication is misconfigured. Contact platform support.');
      }
      if (!dto.totpCode) {
        throw new UnauthorizedException({ message: 'Enter your authenticator code', mfaRequired: true });
      }
      if (!verifyTotp(secret, dto.totpCode)) {
        await this.recordFailedAttempt(user.id, user.failedLoginAttempts);
        throw new UnauthorizedException({ message: 'Enter your authenticator code', mfaRequired: true });
      }
    } else    if (role === 'platform_admin' && this.config.get<string>('AUTH_REQUIRE_PLATFORM_MFA', 'false') === 'true') {
      throw new ForbiddenException('Multi-factor authentication enrollment is required for platform admins');
    }

    if (this.config.get<string>('AUTH_REQUIRE_EMAIL_VERIFICATION', 'false') === 'true' && user.email && !user.emailVerifiedAt) {
      throw new ForbiddenException('Verify your email address before signing in');
    }

    if (
      role === 'customer' &&
      this.config.get<string>('AUTH_REQUIRE_PHONE_VERIFICATION', 'false') === 'true' &&
      user.mobileNumber &&
      !user.mobileVerifiedAt
    ) {
      throw new ForbiddenException('Verify your phone number before signing in');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const device = this.deviceFrom(dto.device, request);
    const tokens = await this.issueTokens(user.id, role, device);

    return {
      role,
      user: this.serializeUser(user),
      memberships: user.memberships.map((membership) => ({
        tenantId: membership.tenantId,
        role: membership.role,
        tenant: { id: membership.tenant.id, name: membership.tenant.name, slug: membership.tenant.slug, status: membership.tenant.status },
      })),
      tenants: user.memberships.map((membership) => ({
        id: membership.tenant.id,
        name: membership.tenant.name,
        slug: membership.tenant.slug,
        status: membership.tenant.status,
        role: membership.role,
      })),
      ...tokens,
    };
  }

  async refresh(dto: MobileRefreshDto, request: Request) {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.prisma.mobileRefreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { memberships: { include: { tenant: true } } } } },
    });

    if (!stored) {
      throw new UnauthorizedException(GENERIC_REFRESH);
    }

    if (stored.revokedAt || stored.replacedByTokenHash) {
      // Reuse of a rotated or revoked token: assume theft and kill the family.
      await this.prisma.mobileRefreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorUserId: stored.userId,
        actorRole: 'mobile',
        entityType: 'mobile_refresh_token',
        entityId: stored.familyId,
        action: 'mobile.refresh.reuse_detected',
        summary: 'Revoked a refresh token family after token reuse',
      });
      throw new UnauthorizedException(GENERIC_REFRESH);
    }

    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException(GENERIC_REFRESH);
    }

    if (stored.deviceId !== dto.deviceId) {
      await this.prisma.mobileRefreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(GENERIC_REFRESH);
    }

    if (stored.user.status !== UserStatus.active) {
      throw new UnauthorizedException(GENERIC_REFRESH);
    }

    const role = this.roleFromSessionAudience(stored.audience, stored.user);
    if (!role) {
      await this.prisma.mobileRefreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(GENERIC_REFRESH);
    }

    const refreshToken = randomToken();
    const expiresAt = new Date(Date.now() + this.refreshDays() * 24 * 60 * 60 * 1000);
    const accessExpiresAt = new Date(Date.now() + this.accessMinutes() * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.mobileRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedByTokenHash: hashToken(refreshToken), lastUsedAt: new Date() },
      }),
      this.prisma.mobileRefreshToken.create({
        data: {
          userId: stored.userId,
          familyId: stored.familyId,
          tokenHash: hashToken(refreshToken),
          deviceId: stored.deviceId,
          deviceName: stored.deviceName ?? this.deviceFrom(undefined, request).name,
          platform: stored.platform,
          audience: stored.audience,
          lastUsedAt: new Date(),
          expiresAt,
        },
      }),
    ]);

    const accessToken = signAccessToken(
      {
        sub: stored.userId,
        sid: stored.familyId,
        aud: ROLE_AUDIENCE[role],
        did: stored.deviceId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(accessExpiresAt.getTime() / 1000),
      },
      this.accessSecret(),
    );

    return {
      role,
      accessToken,
      accessTokenExpiresAt: accessExpiresAt,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  async logout(refreshToken: string) {
    const stored = await this.prisma.mobileRefreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });

    if (stored) {
      await this.prisma.mobileRefreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return { ok: true };
  }

  async logoutAll(context: AuthContext) {
    await this.sessions.revokeAllForUser(context.user.id);
    return { ok: true };
  }

  async listSessions(context: AuthContext) {
    const items = await this.sessions.listForUser(context.user.id);
    return {
      items: items.map((item) => ({
        id: item.id,
        kind: item.kind,
        deviceName: item.deviceName,
        platform: item.platform,
        trustedDevice: item.trustedDevice,
        lastUsedAt: item.lastUsedAt,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        current: item.id === context.sessionId,
      })),
    };
  }

  async revokeSession(context: AuthContext, sessionId: string) {
    const revoked = await this.sessions.revokeListedSession(context.user.id, sessionId);
    if (!revoked) {
      throw new ForbiddenException('Session not found');
    }
    return { ok: true };
  }

  me(context: AuthContext) {
    return { sessionId: context.sessionId, user: context.user };
  }

  async requestPasswordReset(dto: MobilePasswordResetRequestDto) {
    const user = await this.findUserByIdentifier(dto.identifier);
    if (user && user.status === UserStatus.active && user.email && !(user.lockedUntil && user.lockedUntil > new Date())) {
      await this.otp.issue({ userId: user.id, email: user.email, purpose: 'password_reset', name: user.name });
    }
    return { ok: true };
  }

  async confirmPasswordReset(dto: MobilePasswordResetConfirmDto) {
    const user = await this.findUserByIdentifier(dto.identifier);
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.otp.verify({ userId: user.id, purpose: 'password_reset', otp: dto.otp, email: user.email, name: user.name });
    assertStrongPassword(dto.newPassword, { email: user.email, name: user.name });
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.sessions.revokeAllForUser(user.id);

    if (user.email) {
      await this.notifications.enqueueEmail({
        templateKey: 'customer_password_changed',
        recipientEmail: user.email,
        payload: { name: user.name, changedAt: new Date().toISOString() },
      });
    }

    return { ok: true };
  }

  /**
   * Resolves `Authorization: Bearer <access token>`. Cookie auth is deliberately
   * ignored on this surface. `audiences` lets the shared route guards restrict a
   * token to admin-equivalent or customer-equivalent contexts.
   */
  async requireContext(request: Request, audiences?: AccessTokenAudience[]): Promise<AuthContext> {
    const header = request.header('authorization');
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }

    const claims = verifyAccessToken(header.slice(7).trim(), this.accessSecret());
    if (!claims) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    if (audiences && !audiences.includes(claims.aud)) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    const family = await this.prisma.mobileRefreshToken.findFirst({
      where: { familyId: claims.sid, userId: claims.sub, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { deviceId: true, createdAt: true, expiresAt: true },
    });

    if (!family || family.deviceId !== claims.did || family.expiresAt <= new Date()) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: { memberships: { include: { tenant: true } } },
    });

    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    const role = this.resolveRole(user);
    if (!role || role !== this.roleFromAudience(claims.aud)) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    return {
      sessionId: claims.sid,
      authenticatedAt: family.createdAt,
      user: this.serializeUser(user),
    };
  }

  private async issueTokens(userId: string, role: ResolvedRole, device: { id: string; name?: string; platform?: string }) {
    const refreshToken = randomToken();
    const familyId = randomUUID();
    const accessExpiresAt = new Date(Date.now() + this.accessMinutes() * 60 * 1000);
    const refreshExpiresAt = new Date(Date.now() + this.refreshDays() * 24 * 60 * 60 * 1000);

    await this.prisma.mobileRefreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(refreshToken),
        deviceId: device.id,
        deviceName: device.name,
        platform: device.platform,
        audience: ROLE_SESSION_AUDIENCE[role],
        lastUsedAt: new Date(),
        expiresAt: refreshExpiresAt,
      },
    });

    const accessToken = signAccessToken(
      {
        sub: userId,
        sid: familyId,
        aud: ROLE_AUDIENCE[role],
        did: device.id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(accessExpiresAt.getTime() / 1000),
      },
      this.accessSecret(),
    );

    return {
      accessToken,
      accessTokenExpiresAt: accessExpiresAt,
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt,
    };
  }

  private resolveRole(user: {
    platformRole: PlatformRole;
    memberships: Array<{ role: TenantRole }>;
  }): ResolvedRole | null {
    if (user.platformRole === PlatformRole.platform_admin) {
      return 'platform_admin';
    }
    if (user.memberships.some((membership) => [TenantRole.owner, TenantRole.admin, TenantRole.staff].includes(membership.role))) {
      return 'tenant_admin';
    }
    if (user.memberships.length === 0 && user.platformRole === PlatformRole.none) {
      return 'customer';
    }
    return null;
  }

  private roleFromSessionAudience(
    audience: SessionAudience,
    user: { platformRole: PlatformRole; memberships: Array<{ role: TenantRole }> },
  ): ResolvedRole | null {
    const role = this.resolveRole(user);
    if (!role) return null;
    if (ROLE_SESSION_AUDIENCE[role] !== audience) return null;
    return role;
  }

  private roleFromAudience(audience: AccessTokenAudience): ResolvedRole {
    switch (audience) {
      case 'platform':
        return 'platform_admin';
      case 'tenant':
        return 'tenant_admin';
      default:
        return 'customer';
    }
  }

  private async findUserByIdentifier(identifier: string) {
    const email = normalizeEmail(identifier);
    const phone = normalizePhone(identifier);
    const raw = identifier?.trim();
    const identifiers: Prisma.UserWhereInput[] = [];
    if (email) identifiers.push({ email });
    if (phone) identifiers.push({ mobileNumber: phone });
    if (raw && raw !== email && raw !== phone) identifiers.push({ mobileNumber: raw });

    if (identifiers.length === 0) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: { OR: identifiers },
      include: { memberships: { include: { tenant: true } } },
    });
  }

  private async recordFailedAttempt(userId: string, currentFailedAttempts: number) {
    const nextFailedAttempts = currentFailedAttempts + 1;
    const lockThreshold = this.config.get<number>('AUTH_LOCKOUT_THRESHOLD', 10);
    const lockMinutes = this.config.get<number>('AUTH_LOCKOUT_MINUTES', 15);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: nextFailedAttempts,
        lockedUntil: nextFailedAttempts >= lockThreshold ? new Date(Date.now() + lockMinutes * 60 * 1000) : null,
      },
    });
  }

  private serializeUser(user: {
    id: string;
    email: string | null;
    mobileNumber: string | null;
    name: string;
    platformRole: PlatformRole;
    mfaEnabledAt: Date | null;
    mobileVerifiedAt?: Date | null;
    memberships: Array<{ tenantId: string; role: TenantRole; tenant: { id: string; name: string; slug: string; status: string } }>;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      mobileNumber: user.mobileNumber,
      name: user.name,
      platformRole: user.platformRole,
      mfaEnabled: Boolean(user.mfaEnabledAt),
      mobileVerified: Boolean(user.mobileVerifiedAt),
      memberships: user.memberships.map((membership) => ({
        tenantId: membership.tenantId,
        role: membership.role,
        tenant: {
          id: membership.tenant.id,
          name: membership.tenant.name,
          slug: membership.tenant.slug,
          status: membership.tenant.status,
        },
      })),
    };
  }

  private deviceFrom(device: { id: string; name?: string; platform?: string } | undefined, request: Request) {
    const userAgent = request.header('user-agent')?.slice(0, 120);
    const platform =
      device?.platform ?? (!userAgent ? 'unknown' : /android/i.test(userAgent) ? 'android' : /iphone|ipad|ios/i.test(userAgent) ? 'ios' : 'web');
    return {
      id: device?.id ?? `ua-${hashToken(userAgent ?? 'unknown').slice(0, 24)}`,
      name: device?.name ?? userAgent,
      platform,
    };
  }

  private accessSecret() {
    return this.config.get<string>('SESSION_SECRET', 'local-session-secret-change-me');
  }

  private accessMinutes() {
    return this.config.get<number>('AUTH_ACCESS_TOKEN_MINUTES', 15);
  }

  private refreshDays() {
    return this.config.get<number>('AUTH_REFRESH_TOKEN_DAYS', 30);
  }
}
