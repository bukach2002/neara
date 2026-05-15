import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole, TenantRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CsrfService } from './csrf.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthContext, AuthenticatedUser } from './types';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly csrf: CsrfService,
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto, request: Request, response: Response) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { tenant: true } } },
    });

    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account is temporarily locked');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Invalid email or password');
    }

    const sessionToken = this.createToken();
    const tokenHash = this.hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.session.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    const csrfToken = this.csrf.createToken(sessionToken);
    this.setSessionCookie(response, sessionToken, expiresAt);
    this.setCsrfCookie(response, csrfToken, expiresAt);

    return {
      user: this.serializeUser(user),
      csrfToken,
    };
  }

  async logout(request: Request, response: Response) {
    const sessionToken = this.getCookie(request, this.sessionCookieName());
    if (sessionToken) {
      await this.prisma.session.deleteMany({ where: { tokenHash: this.hashToken(sessionToken) } });
    }

    this.clearCookie(response, this.sessionCookieName(), true);
    this.clearCookie(response, this.csrf.cookieName(), false);

    return { ok: true };
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.status === UserStatus.active) {
      const token = this.createToken();
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
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
    const tokenHash = this.hashToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date() || resetToken.user.status !== UserStatus.active) {
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
      this.prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
    ]);

    return { ok: true };
  }

  async requireAdminContext(request: Request, options: { requireCsrf: boolean }): Promise<AuthContext> {
    const sessionToken = this.getCookie(request, this.sessionCookieName());
    if (!sessionToken) {
      throw new UnauthorizedException('Admin session is required');
    }

    if (options.requireCsrf) {
      this.csrf.verifyRequest(request, sessionToken);
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(sessionToken) },
      include: {
        user: {
          include: {
            memberships: {
              include: { tenant: true },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt <= new Date() || session.user.status !== UserStatus.active) {
      throw new UnauthorizedException('Admin session is invalid or expired');
    }

    return {
      sessionId: session.id,
      user: this.serializeUser(session.user),
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
    const allowedRoles = new Set<TenantRole>([TenantRole.owner, TenantRole.admin, TenantRole.staff]);
    const memberships = context.user.memberships.filter((membership) => allowedRoles.has(membership.role));

    if (tenantId && !memberships.some((membership) => membership.tenantId === tenantId)) {
      throw new ForbiddenException('Tenant access is required');
    }

    if (!tenantId && memberships.length === 0) {
      throw new ForbiddenException('Tenant access is required');
    }

    return context;
  }

  serializeContext(context: AuthContext) {
    return {
      sessionId: context.sessionId,
      user: context.user,
    };
  }

  private async recordFailedLogin(userId: string, currentFailedAttempts: number) {
    const nextFailedAttempts = currentFailedAttempts + 1;
    const lockThreshold = this.config.get<number>('RATE_LIMIT_ADMIN_LOGIN_PER_WINDOW', 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: nextFailedAttempts,
        lockedUntil: nextFailedAttempts >= lockThreshold ? new Date(Date.now() + FIFTEEN_MINUTES_MS) : null,
      },
    });
  }

  private serializeUser(user: {
    id: string;
    email: string;
    name: string;
    platformRole: PlatformRole;
    memberships: Array<{
      tenantId: string;
      role: TenantRole;
      tenant: { id: string; name: string; slug: string; status: string };
    }>;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole,
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

  private createToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private setSessionCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie(this.sessionCookieName(), token, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });
  }

  private setCsrfCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie(this.csrf.cookieName(), token, {
      httpOnly: false,
      secure: this.isProduction(),
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });
  }

  private clearCookie(response: Response, name: string, httpOnly: boolean) {
    response.clearCookie(name, {
      httpOnly,
      secure: this.isProduction(),
      sameSite: 'lax',
      path: '/',
    });
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

  private sessionCookieName() {
    return this.config.get<string>('SESSION_COOKIE_NAME', 'neara.sid');
  }

  private isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private isUnsafeMethod(method: string) {
    return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }

  safeCompare(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
