import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel, OtpPurpose, PlatformRole, SessionAudience, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerLoginDto,
  CustomerOtpConfirmDto,
  CustomerOtpRequestDto,
  CustomerPasswordResetConfirmDto,
  CustomerRegisterDto,
} from './dto/customer-auth.dto';

const STANDARD_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const TRUSTED_SESSION_MS = 365 * 24 * 60 * 60 * 1000;
const OTP_EXPIRES_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: CustomerRegisterDto, response: Response) {
    const email = this.normalizeEmail(dto.email);
    const mobileNumber = this.normalizeMobile(dto.mobileNumber);
    if (!email && !mobileNumber) {
      throw new BadRequestException('Email or mobile number is required');
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [email ? { email } : {}, mobileNumber ? { mobileNumber } : {}].filter((item) => Object.keys(item).length > 0) },
    });
    if (existing) {
      throw new ConflictException('An account already exists for these details');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        mobileNumber,
        passwordHash,
        platformRole: PlatformRole.none,
      },
      include: { memberships: { include: { tenant: true } } },
    });

    const session = await this.createCustomerSession(user.id, Boolean(dto.trustDevice), response);
    return { user: this.serializeCustomer(user), ...session };
  }

  async login(dto: CustomerLoginDto, response: Response) {
    const user = await this.findCustomerByIdentifier(dto.identifier);
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Invalid identifier or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid identifier or password');
    }

    const session = await this.createCustomerSession(user.id, Boolean(dto.trustDevice), response);
    return { user: this.serializeCustomer(user), ...session };
  }

  async requestOtp(dto: CustomerOtpRequestDto) {
    const channel = dto.channel ?? 'email';
    const purpose = dto.purpose ?? 'login';
    const user = await this.findCustomerByIdentifier(dto.identifier);

    if (user?.status === UserStatus.active && channel === 'email' && user.email) {
      const otp = this.createOtp();
      await this.prisma.otpToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashOtp(user.id, purpose, otp),
          purpose: purpose as OtpPurpose,
          channel: OtpChannel.email,
          recipient: user.email,
          expiresAt: new Date(Date.now() + OTP_EXPIRES_MS),
        },
      });

      await this.notifications.enqueueEmail({
        templateKey: purpose === 'login' ? 'customer_login_otp' : 'customer_password_reset_otp',
        recipientEmail: user.email,
        payload: {
          name: user.name,
          otp,
          purpose,
        },
      });
    }

    return { ok: true };
  }

  async confirmOtp(dto: CustomerOtpConfirmDto, response: Response) {
    if (dto.purpose !== 'login') {
      throw new BadRequestException('Use the password reset endpoint for reset OTP confirmation');
    }

    const user = await this.verifyOtp(dto.identifier, dto.otp, dto.purpose);
    const session = await this.createCustomerSession(user.id, Boolean(dto.trustDevice), response);
    return { user: this.serializeCustomer(user), ...session };
  }

  async confirmPasswordReset(dto: CustomerPasswordResetConfirmDto) {
    const user = await this.verifyOtp(dto.identifier, dto.otp, 'password_reset');
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.session.deleteMany({ where: { userId: user.id, audience: SessionAudience.customer } }),
    ]);

    return { ok: true };
  }

  async logout(request: Request, response: Response) {
    const sessionToken = this.getCookie(request, this.cookieName());
    if (sessionToken) {
      await this.prisma.session.deleteMany({
        where: { tokenHash: this.hashToken(sessionToken), audience: SessionAudience.customer },
      });
    }
    this.clearCookie(response);
    return { ok: true };
  }

  async me(request: Request) {
    const sessionToken = this.getCookie(request, this.cookieName());
    if (!sessionToken) {
      throw new UnauthorizedException('Customer session is required');
    }

    const session = await this.prisma.session.findFirst({
      where: { tokenHash: this.hashToken(sessionToken), audience: SessionAudience.customer },
      include: { user: { include: { memberships: { include: { tenant: true } } } } },
    });

    if (!session || session.expiresAt <= new Date() || session.user.status !== UserStatus.active) {
      throw new UnauthorizedException('Customer session is invalid or expired');
    }

    return { sessionId: session.id, user: this.serializeCustomer(session.user) };
  }

  async deleteMe(request: Request, response: Response) {
    const sessionToken = this.getCookie(request, this.cookieName());
    if (!sessionToken) {
      throw new UnauthorizedException('Customer session is required');
    }

    const session = await this.prisma.session.findFirst({
      where: { tokenHash: this.hashToken(sessionToken), audience: SessionAudience.customer },
      include: { user: { include: { memberships: true } } },
    });

    if (!session || session.expiresAt <= new Date() || session.user.status !== UserStatus.active || session.user.memberships.length > 0) {
      throw new UnauthorizedException('Customer session is invalid or expired');
    }

    await this.prisma.$transaction([
      this.prisma.customer.updateMany({
        where: { userId: session.userId },
        data: {
          userId: null,
          name: 'Deleted Customer',
          phone: null,
          email: null,
        },
      }),
      this.prisma.otpToken.deleteMany({ where: { userId: session.userId } }),
      this.prisma.session.deleteMany({ where: { userId: session.userId, audience: SessionAudience.customer } }),
      this.prisma.user.update({
        where: { id: session.userId },
        data: {
          email: null,
          mobileNumber: null,
          name: 'Deleted Customer',
          status: UserStatus.inactive,
          passwordHash: this.createToken(),
        },
      }),
    ]);

    this.clearCookie(response);
    return { ok: true };
  }

  private async verifyOtp(identifier: string, otp: string, purpose: 'login' | 'password_reset') {
    const user = await this.findCustomerByIdentifier(identifier);
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const tokenHash = this.hashOtp(user.id, purpose, otp);
    const token = await this.prisma.otpToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        purpose: purpose as OtpPurpose,
        channel: OtpChannel.email,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token || token.expiresAt <= new Date() || token.attempts >= MAX_OTP_ATTEMPTS) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.prisma.otpToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date(), attempts: { increment: 1 } },
    });

    return user;
  }

  private async findCustomerByIdentifier(identifier: string) {
    const normalized = identifier.trim().toLowerCase();
    const mobile = identifier.trim();
    return this.prisma.user.findFirst({
      where: {
        status: UserStatus.active,
        platformRole: PlatformRole.none,
        memberships: { none: {} },
        OR: [{ email: normalized }, { mobileNumber: mobile }],
      },
      include: { memberships: { include: { tenant: true } } },
    });
  }

  private async createCustomerSession(userId: string, trustedDevice: boolean, response: Response) {
    const sessionToken = this.createToken();
    const expiresAt = new Date(Date.now() + (trustedDevice ? TRUSTED_SESSION_MS : STANDARD_SESSION_MS));
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(sessionToken),
        audience: SessionAudience.customer,
        trustedDevice,
        expiresAt,
      },
    });

    response.cookie(this.cookieName(), sessionToken, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return { trustedDevice, expiresAt };
  }

  private serializeCustomer(user: { id: string; email: string | null; mobileNumber: string | null; name: string }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
    };
  }

  private normalizeEmail(email?: string) {
    const trimmed = email?.trim().toLowerCase();
    return trimmed || undefined;
  }

  private normalizeMobile(mobileNumber?: string) {
    const trimmed = mobileNumber?.trim();
    return trimmed || undefined;
  }

  private createOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private createToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashOtp(userId: string, purpose: string, otp: string) {
    return createHash('sha256')
      .update(`${userId}:${purpose}:${otp}:${this.config.get<string>('SESSION_SECRET', 'local-session-secret-change-me')}`)
      .digest('hex');
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

  private clearCookie(response: Response) {
    response.clearCookie(this.cookieName(), {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      path: '/',
    });
  }

  private cookieName() {
    return this.config.get<string>('CUSTOMER_SESSION_COOKIE_NAME', 'neara.customer.sid');
  }

  private isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
