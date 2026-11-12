import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole, TenantRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { constantTimeEquals, normalizeEmail } from '../../support/security';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CsrfService } from './csrf.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MfaService } from './mfa.service';
import { MobileAuthService } from './mobile-auth.service';
import { SessionService } from './session.service';
import { decryptSecret, hashToken, randomToken, verifyTotp, type AccessTokenAudience } from './token.service';
import { AuthContext, AuthenticatedUser } from './types';

const PASSWORD_RESET_TOKEN_MS = 60 * 60 * 1000;
const TENANT_ROLES = new Set<TenantRole>([TenantRole.owner, TenantRole.admin, TenantRole.staff]);
const GENERIC_CREDENTIALS = 'Invalid email or password';
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomToken(16), 10);

function hasBearerHeader(request: Request) {
  return request.header('authorization')?.toLowerCase().startsWith('bearer ') ?? false;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly csrf: CsrfService,
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    /**
     * Native clients hold bearer tokens instead of cookies. The same route guards
     * accept either credential: CSRF applies to cookie auth only, because a bearer
     * header is never attached automatically by a browser.
     */
    private readonly mobileAuth: MobileAuthService,
  ) {}

  /**
   * Admin/tenant-admin sign in. The role is resolved server-side after a single
   * password verification and no session is minted for accounts without a
   * workspace, so a plain customer can never hold an admin-audience cookie.
   */
  async login(dto: LoginDto, request: Request, response: Response) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { tenant: true } } },
    });

    if (!user) {
      // Constant-ish work for unknown accounts keeps responses indistinguishable.
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Never disclose lock state: it confirms a valid account and helps an
      // attacker time a targeted lockout.
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    if (user.status !== UserStatus.active) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    const workspaceRoles = user.memberships
      .filter((membership) => TENANT_ROLES.has(membership.role))
      .map((membership) => membership.role);
    const hasWorkspace = user.platformRole === PlatformRole.platform_admin || workspaceRoles.length > 0;

    if (!hasWorkspace) {
      await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new ForbiddenException('This account does not have workspace access');
    }

    if (this.config.get<string>('AUTH_REQUIRE_EMAIL_VERIFICATION', 'false') === 'true' && user.email && !user.emailVerifiedAt) {
      throw new ForbiddenException('Verify your email address before signing in');
    }

    if (user.mfaEnabledAt) {
      const secret = user.mfaSecretCiphertext ? decryptSecret(user.mfaSecretCiphertext, this.config.get<string>('SESSION_SECRET', 'local-session-secret-change-me')) : null;
      if (!secret) {
        throw new ForbiddenException('Multi-factor authentication is misconfigured. Contact platform support.');
      }
      if (!dto.totpCode) {
        throw new UnauthorizedException({ message: 'Enter your authenticator code', mfaRequired: true });
      }
      if (!verifyTotp(secret, dto.totpCode)) {
        await this.recordFailedLogin(user.id, user.failedLoginAttempts);
        throw new UnauthorizedException({ message: 'Enter your authenticator code', mfaRequired: true });
      }
    } else if (
      this.config.get<string>('AUTH_REQUIRE_PLATFORM_MFA', 'false') === 'true' &&
      user.platformRole === PlatformRole.platform_admin
    ) {
      throw new ForbiddenException('Multi-factor authentication enrollment is required for platform admins');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const session = await this.sessions.createCookieSession({
      userId: user.id,
      audience: 'admin',
      response,
      device: this.deviceFrom(request),
    });

    return {
      user: this.serializeUser(user),
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Opens an admin-audience session for a user that was just created or verified
   * elsewhere (for example tenant self signup) and sets the session + CSRF cookies.
   */
  async establishAdminSession(userId: string, response: Response, request?: Request) {
    const session = await this.sessions.createCookieSession({
      userId,
      audience: 'admin',
      response,
      device: request ? this.deviceFrom(request) : undefined,
    });

    return { csrfToken: session.csrfToken, expiresAt: session.expiresAt };
  }

  /**
   * Idempotent but CSRF protected: signing out a session that does not belong to
   * the caller is exactly the victim-logout attack CSRF prevents.
   */
  async logout(request: Request, response: Response) {
    const token = this.sessions.readCookie(request, this.sessions.sessionCookieName('admin'));
    if (token) {
      this.csrf.verifyRequest(request, token);
      this.csrf.verifyOrigin(request, this.allowedOrigins());
      await this.sessions.revokeByToken(token, 'admin');
    }

    this.sessions.clearCookies(response, 'admin');
    return { ok: true };
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.email && user.status === UserStatus.active) {
      const token = randomToken();
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_MS),
        },
      });

      const resetUrl = `${this.config.get<string>('WEB_APP_URL', 'http://localhost:3000')}/admin/reset-password?token=${encodeURIComponent(token)}`;
      await this.notifications.enqueueEmail({
        templateKey: 'admin_password_reset',
        recipientEmail: user.email,
        payload: {
          userId: user.id,
          email: user.email,
          name: user.name,
          resetUrl,
        },
      });
    }

    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      include: { user: true },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date() ||
      resetToken.user.status !== UserStatus.active
    ) {
      throw new BadRequestException('Password reset token is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          passwordResetAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // A reset revokes every session (web and native) for the account.
    await this.sessions.revokeAllForUser(resetToken.userId);

    return { ok: true };
  }

  async requireAdminContext(
    request: Request,
    options: { requireCsrf: boolean; allowedOrigins?: string[] } = { requireCsrf: false },
  ): Promise<AuthContext> {
    const bearer = await this.bearerContext(request, ['platform', 'tenant']);
    if (bearer) {
      return bearer;
    }

    const session = await this.sessions.requireSession(request, 'admin', {
      requireCsrf: options.requireCsrf,
      allowedOrigins: options.allowedOrigins,
    });

    return {
      sessionId: session.sessionId,
      authenticatedAt: session.createdAt,
      user: this.toAuthenticatedUser(session.user),
    };
  }

  async requirePlatformAdmin(request: Request): Promise<AuthContext> {
    const context = await this.requireAdminContext(request, { requireCsrf: this.isUnsafeMethod(request.method) });
    if (context.user.platformRole !== PlatformRole.platform_admin) {
      throw new ForbiddenException('Platform admin access is required');
    }
    return context;
  }

  async requireTenantAdmin(request: Request, tenantId?: string): Promise<AuthContext> {
    const context = await this.requireAdminContext(request, { requireCsrf: this.isUnsafeMethod(request.method) });
    const memberships = context.user.memberships.filter((membership) => TENANT_ROLES.has(membership.role));

    if (tenantId && !memberships.some((membership) => membership.tenantId === tenantId)) {
      throw new ForbiddenException('Tenant access is required');
    }

    if (!tenantId && memberships.length === 0) {
      throw new ForbiddenException('Tenant access is required');
    }

    return context;
  }

  async requireCustomerContext(request: Request, options: { requireCsrf?: boolean } = {}): Promise<AuthContext> {
    const bearer = await this.bearerContext(request, ['customer']);
    if (bearer) {
      return bearer;
    }

    const session = await this.sessions.requireSession(request, 'customer', {
      requireCsrf: options.requireCsrf,
      allowedOrigins: this.allowedOrigins(),
    });

    return {
      sessionId: session.sessionId,
      authenticatedAt: session.createdAt,
      user: this.toAuthenticatedUser(session.user),
    };
  }

  /**
   * Optional customer context: a bearer token or customer cookie is accepted, but
   * an anonymous caller is not an error.
   */
  async optionalCustomerContext(request: Request): Promise<AuthContext | null> {
    if (hasBearerHeader(request)) {
      return this.mobileAuth.requireContext(request, ['customer']);
    }

    try {
      return await this.requireCustomerContext(request);
    } catch {
      return null;
    }
  }

  /** Resolves a native access token when present, without touching cookies. */
  private async bearerContext(request: Request, audiences: AccessTokenAudience[]): Promise<AuthContext | null> {
    if (!hasBearerHeader(request)) {
      return null;
    }
    return this.mobileAuth.requireContext(request, audiences);
  }

  /**
   * Step-up authentication for the most destructive platform actions. Active
   * whenever the operator has MFA enrolled or platform MFA is required.
   */
  assertFreshAuthentication(context: AuthContext) {
    const mfaRequired = this.config.get<string>('AUTH_REQUIRE_PLATFORM_MFA', 'false') === 'true';
    if (!context.user.mfaEnabled && !mfaRequired) {
      return;
    }

    const minutes = this.config.get<number>('AUTH_STEP_UP_MINUTES', 15);
    const ageMs = Date.now() - context.authenticatedAt.getTime();
    if (ageMs > minutes * 60 * 1000) {
      throw new ForbiddenException({
        message: 'Re-authenticate to continue. This action needs a recent sign-in.',
        code: 'step_up_required',
      });
    }
  }

  serializeContext(context: AuthContext) {
    return {
      sessionId: context.sessionId,
      user: context.user,
    };
  }

  safeCompare(left: string, right: string) {
    return constantTimeEquals(hashToken(left), hashToken(right));
  }

  private async recordFailedLogin(userId: string, currentFailedAttempts: number) {
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

  private deviceFrom(request: Request) {
    const userAgent = request.header('user-agent')?.slice(0, 120);
    return {
      name: userAgent || undefined,
      platform: this.platformFromUserAgent(userAgent),
    };
  }

  private platformFromUserAgent(userAgent?: string) {
    if (!userAgent) return undefined;
    if (/android/i.test(userAgent)) return 'android';
    if (/iphone|ipad|ios/i.test(userAgent)) return 'ios';
    return 'web';
  }

  private allowedOrigins() {
    const webAppUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:3000');
    const extra = this.config.get<string>('CORS_ALLOWED_ORIGINS', '');
    return [webAppUrl, ...extra.split(',')];
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string | null;
    mobileNumber: string | null;
    name: string;
    platformRole: PlatformRole;
    mfaEnabledAt: Date | null;
    mobileVerifiedAt?: Date | null;
    memberships: Array<{
      tenantId: string;
      role: TenantRole;
      tenant: { id: string; name: string; slug: string; status: string };
    }>;
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

  private serializeUser(user: {
    id: string;
    email: string | null;
    mobileNumber: string | null;
    name: string;
    platformRole: PlatformRole;
    mfaEnabledAt: Date | null;
    mobileVerifiedAt?: Date | null;
    memberships: Array<{
      tenantId: string;
      role: TenantRole;
      tenant: { id: string; name: string; slug: string; status: string };
    }>;
  }): AuthenticatedUser {
    return this.toAuthenticatedUser(user);
  }

  private isUnsafeMethod(method: string) {
    return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }
}
