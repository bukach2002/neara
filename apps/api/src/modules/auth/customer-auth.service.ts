import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole, Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import { assertStrongPassword, normalizeEmail, normalizePhone, redactPiiJson } from '../../support/security';
import { CsrfService } from './csrf.service';
import { OtpService, type OtpPurposeName } from './otp.service';
import { SessionService } from './session.service';
import { randomToken } from './token.service';
import {
  CustomerLoginDto,
  CustomerOtpConfirmDto,
  CustomerOtpRequestDto,
  CustomerPasswordResetConfirmDto,
  CustomerRegisterDto,
} from './dto/customer-auth.dto';

const GENERIC_CREDENTIALS = 'Invalid identifier or password';
const GENERIC_OTP = 'Invalid or expired code';
// Valid hash of a value nobody knows, used to equalise timing for unknown accounts.
const UNKNOWN_ACCOUNT_HASH = bcrypt.hashSync(randomToken(16), 10);

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
    private readonly csrf: CsrfService,
  ) {}

  async register(dto: CustomerRegisterDto, request: Request, response: Response) {
    const email = normalizeEmail(dto.email);
    const mobileNumber = normalizePhone(dto.mobileNumber);
    if (!email && !mobileNumber) {
      throw new BadRequestException('Email or mobile number is required');
    }
    if (dto.email && !email) {
      throw new BadRequestException('Enter a valid email address');
    }
    if (dto.mobileNumber && !mobileNumber) {
      throw new BadRequestException('Enter a valid mobile number including country code');
    }

    assertStrongPassword(dto.password, { email, name: dto.name });

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [...(email ? [{ email }] : []), ...(mobileNumber ? [{ mobileNumber }] : [])],
      },
      select: { id: true },
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
    });

    if (email) {
      await this.otp.issue({ userId: user.id, email, purpose: 'verify_email', name: user.name });
    }

    const session = await this.sessions.createCookieSession({
      userId: user.id,
      audience: 'customer',
      response,
      trustedDevice: Boolean(dto.trustDevice),
      device: this.deviceFrom(request),
    });

    return { user: this.serializeCustomer(user), trustedDevice: Boolean(dto.trustDevice), expiresAt: session.expiresAt };
  }

  async login(dto: CustomerLoginDto, request: Request, response: Response) {
    const user = await this.findCustomerByIdentifier(dto.identifier);

    if (!user) {
      // Equalise timing and return the same message for unknown accounts.
      await bcrypt.compare(dto.password, UNKNOWN_ACCOUNT_HASH);
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Never disclose lock state: it confirms an account and enables targeted lockout.
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordFailedAttempt(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    if (user.status !== UserStatus.active) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS);
    }

    if (!this.verifiedForLogin(user)) {
      throw new UnauthorizedException('Verify your email address before signing in');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const session = await this.sessions.createCookieSession({
      userId: user.id,
      audience: 'customer',
      response,
      trustedDevice: Boolean(dto.trustDevice),
      device: this.deviceFrom(request),
    });

    return { user: this.serializeCustomer(user), trustedDevice: Boolean(dto.trustDevice), expiresAt: session.expiresAt };
  }

  /**
   * Issues a login or password-reset OTP. The response is always `{ ok: true }`
   * so unknown identifiers cannot be enumerated.
   */
  async requestOtp(dto: CustomerOtpRequestDto) {
    const purpose = dto.purpose ?? 'login';
    const channel = dto.channel === 'sms' || dto.channel === 'whatsapp' ? dto.channel : 'email';
    const user = await this.findCustomerByIdentifier(dto.identifier);
    const hasRecipient = channel === 'email' ? Boolean(user?.email) : Boolean(user?.mobileNumber);

    // Always answer `{ ok: true }`: a different status would reveal the account.
    if (user?.status === UserStatus.active && hasRecipient && !(user.lockedUntil && user.lockedUntil > new Date())) {
      await this.otp.issue({
        userId: user.id,
        purpose,
        name: user.name,
        channel,
        email: user.email,
        phone: user.mobileNumber,
      });
    }

    return { ok: true };
  }

  async requestEmailVerification(identifier: string) {
    const user = await this.findCustomerByIdentifier(identifier);
    if (user?.status === UserStatus.active && user.email) {
      await this.otp.issue({ userId: user.id, email: user.email, purpose: 'verify_email', name: user.name });
    }
    return { ok: true };
  }

  async confirmEmailVerification(identifier: string, code: string) {
    const user = await this.findCustomerByIdentifier(identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    await this.otp.verify({ userId: user.id, purpose: 'verify_email', otp: code, email: user.email, name: user.name });
    await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return { ok: true, verified: true };
  }

  /**
   * Phone ownership verification over SMS or WhatsApp. Identical generic
   * responses so an unknown identifier cannot be enumerated.
   */
  async requestPhoneVerification(identifier: string, channel: 'sms' | 'whatsapp') {
    const user = await this.findCustomerByIdentifier(identifier);
    if (
      user?.status === UserStatus.active &&
      user.mobileNumber &&
      !(user.lockedUntil && user.lockedUntil > new Date())
    ) {
      await this.otp.issue({
        userId: user.id,
        purpose: 'verify_mobile',
        name: user.name,
        channel,
        phone: user.mobileNumber,
        email: user.email,
      });
    }
    return { ok: true };
  }

  async confirmPhoneVerification(identifier: string, code: string, channel: 'sms' | 'whatsapp') {
    const user = await this.findCustomerByIdentifier(identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    await this.otp.verify({
      userId: user.id,
      purpose: 'verify_mobile',
      otp: code,
      channel,
      email: user.email,
      name: user.name,
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { mobileVerifiedAt: new Date() } });
    return { ok: true, verified: true };
  }

  async confirmOtp(dto: CustomerOtpConfirmDto, request: Request, response: Response) {
    if (dto.purpose !== 'login') {
      throw new BadRequestException('Use the password reset endpoint for reset OTP confirmation');
    }

    const user = await this.verifyOtp(dto.identifier, dto.otp, 'login', dto.channel);
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });

    const session = await this.sessions.createCookieSession({
      userId: user.id,
      audience: 'customer',
      response,
      trustedDevice: Boolean(dto.trustDevice),
      device: this.deviceFrom(request),
    });

    return { user: this.serializeCustomer(user), trustedDevice: Boolean(dto.trustDevice), expiresAt: session.expiresAt };
  }

  async confirmPasswordReset(dto: CustomerPasswordResetConfirmDto) {
    const user = await this.verifyOtp(dto.identifier, dto.otp, 'password_reset');
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

    // Password reset revokes every web session and native refresh family.
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

  async logout(request: Request, response: Response) {
    const token = this.sessions.readCookie(request, this.sessions.sessionCookieName('customer'));
    if (token) {
      // Cookie-authenticated mutation: prove client intent before revoking.
      this.csrf.verifyRequest(request, token);
      this.csrf.verifyOrigin(request, this.allowedOrigins());
      await this.sessions.revokeByToken(token, 'customer');
    }
    this.sessions.clearCookies(response, 'customer');
    return { ok: true };
  }

  async me(request: Request) {
    const session = await this.sessions.requireSession(request, 'customer');
    return {
      sessionId: session.sessionId,
      user: this.serializeCustomer({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        mobileNumber: session.user.mobileNumber,
        emailVerifiedAt: session.user.emailVerifiedAt,
        mobileVerifiedAt: session.user.mobileVerifiedAt,
        mfaEnabledAt: session.user.mfaEnabledAt,
      }),
    };
  }

  /**
   * Right-to-erasure. Anonymises the profile, every booking snapshot, attempt
   * log, notification payload and audit snapshot, revokes all sessions and
   * records an audit entry for the deletion itself.
   */
  async deleteMe(request: Request, response: Response, sourceIp?: string) {
    const session = await this.sessions.requireSession(request, 'customer', {
      requireCsrf: true,
      allowedOrigins: this.allowedOrigins(),
    });

    const result = await this.eraseForUser(session.userId, sourceIp);
    this.sessions.clearCookies(response, 'customer');
    return result;
  }

  /**
   * Erases every record tied to an account. Shared by the cookie (web) and the
   * bearer (native) surfaces so both remove exactly the same data.
   */
  async eraseForUser(userId: string, sourceIp?: string) {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, mobileNumber: true },
    });

    const customerProfile = await this.prisma.customer.findFirst({
      where: { userId },
      select: { id: true },
    });
    const memberships = await this.prisma.tenantMembership.count({ where: { userId } });
    if (memberships > 0) {
      throw new BadRequestException('Workspace accounts cannot be deleted from the customer app');
    }

    const customers = await this.prisma.customer.findMany({ where: { userId } });
    const emails = new Set<string>();
    const phones = new Set<string>();
    for (const customer of customers) {
      if (customer.email) emails.add(customer.email.toLowerCase());
      if (customer.phone) phones.add(customer.phone);
    }
    const bookings = await this.prisma.booking.findMany({
      where: { customerId: { in: customers.map((customer) => customer.id) } },
      select: { customerEmailSnapshot: true, customerPhoneSnapshot: true },
    });
    for (const booking of bookings) {
      if (booking.customerEmailSnapshot) emails.add(booking.customerEmailSnapshot.toLowerCase());
      if (booking.customerPhoneSnapshot) phones.add(booking.customerPhoneSnapshot);
    }
    if (account?.email) emails.add(account.email.toLowerCase());
    if (account?.mobileNumber) phones.add(account.mobileNumber);

    const result = await this.prisma.$transaction(async (tx) => {
      const customerUpdate = await tx.customer.updateMany({
        where: { userId },
        data: { userId: null, name: 'Deleted Customer', phone: null, email: null },
      });

      const customerIds = customers.map((customer) => customer.id);
      const bookingUpdate = await tx.booking.updateMany({
        where: {
          OR: [
            { customerId: { in: customerIds } },
            ...(emails.size > 0 ? [{ customerEmailSnapshot: { in: [...emails] } }] : []),
            ...(phones.size > 0 ? [{ customerPhoneSnapshot: { in: [...phones] } }] : []),
          ],
        },
        data: {
          customerNameSnapshot: 'Deleted Customer',
          customerPhoneSnapshot: null,
          customerEmailSnapshot: null,
          customerNote: null,
        },
      });

      const attemptUpdate = await tx.bookingAttemptLog.updateMany({
        where: {
          OR: [
            ...(emails.size > 0 ? [{ customerEmail: { in: [...emails] } }] : []),
            ...(phones.size > 0 ? [{ customerPhone: { in: [...phones] } }] : []),
          ],
        },
        data: { customerName: 'Deleted Customer', customerPhone: null, customerEmail: null, customerNote: null },
      });

      const notificationLogs = await tx.notificationLog.findMany({
        where: {
          OR: [
            ...(emails.size > 0 ? [{ recipientEmail: { in: [...emails] } }] : []),
            ...(phones.size > 0 ? [{ recipientPhone: { in: [...phones] } }] : []),
          ],
        },
        select: { id: true, payload: true },
      });
      for (const log of notificationLogs) {
        await tx.notificationLog.update({
          where: { id: log.id },
          data: { recipientEmail: null, recipientPhone: null, payload: redactPiiJson(log.payload) as Prisma.InputJsonValue },
        });
      }

      await tx.otpToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.mobileRefreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: null,
          mobileNumber: null,
          name: 'Deleted Customer',
          status: UserStatus.inactive,
          passwordHash: await bcrypt.hash(randomToken(32), 12),
          emailVerifiedAt: null,
          mobileVerifiedAt: null,
          mfaSecretCiphertext: null,
          mfaEnabledAt: null,
        },
      });

      return {
        customerId: customerProfile?.id ?? null,
        customers: customerUpdate.count,
        bookings: bookingUpdate.count,
        bookingAttempts: attemptUpdate.count,
        notifications: notificationLogs.length,
      };
    });

    await this.audit.record({
      actorUserId: null,
      actorRole: 'customer',
      entityType: 'customer',
      entityId: userId,
      action: 'customer.self_delete',
      summary: 'Customer erased their account and associated personal data',
      after: this.asJson({ ...result, requestedBy: 'self' }),
      sourceIp,
    });

    return { ok: true };
  }

  /**
   * Attempt accounting and lockout now live in OtpService so the bearer surface
   * shares the exact same rules. Failures here are always generic.
   */
  private async verifyOtp(identifier: string, otp: string, purpose: OtpPurposeName, channel?: 'email' | 'sms' | 'whatsapp') {
    const user = await this.findCustomerByIdentifier(identifier);
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException(GENERIC_OTP);
    }

    await this.otp.verify({ userId: user.id, purpose, otp, channel, email: user.email, name: user.name });

    return user;
  }

  private verifiedForLogin(user: { email: string | null; mobileNumber: string | null; emailVerifiedAt: Date | null; mobileVerifiedAt: Date | null }) {
    if (this.config.get<string>('AUTH_REQUIRE_EMAIL_VERIFICATION', 'false') === 'true' && user.email && !user.emailVerifiedAt) {
      return false;
    }
    if (this.config.get<string>('AUTH_REQUIRE_PHONE_VERIFICATION', 'false') === 'true' && user.mobileNumber && !user.mobileVerifiedAt) {
      return false;
    }
    return true;
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

  /**
   * Customers are identified by email (case-insensitive) or E.164 phone, so
   * "+91 98765 43210" and "+919876543210" resolve to the same account.
   */
  private async findCustomerByIdentifier(identifier: string) {
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
      where: {
        status: UserStatus.active,
        platformRole: PlatformRole.none,
        memberships: { none: {} },
        OR: identifiers,
      },
      include: { memberships: { include: { tenant: true } } },
    });
  }

  private serializeCustomer(user: {
    id: string;
    email: string | null;
    mobileNumber: string | null;
    name: string;
    emailVerifiedAt?: Date | null;
    mobileVerifiedAt?: Date | null;
    mfaEnabledAt?: Date | null;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      emailVerified: Boolean(user.emailVerifiedAt),
      mobileVerified: Boolean(user.mobileVerifiedAt),
      mfaEnabled: Boolean(user.mfaEnabledAt),
    };
  }

  private deviceFrom(request: Request) {
    const userAgent = request.header('user-agent')?.slice(0, 120);
    const platform = !userAgent ? undefined : /android/i.test(userAgent) ? 'android' : /iphone|ipad|ios/i.test(userAgent) ? 'ios' : 'web';
    return { name: userAgent || undefined, platform };
  }

  private allowedOrigins() {
    const webAppUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:3000');
    const extra = this.config.get<string>('CORS_ALLOWED_ORIGINS', '');
    return [webAppUrl, ...extra.split(',')];
  }

  private asJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
