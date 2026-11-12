import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { constantTimeEquals } from '../../support/security';
import { hashToken, randomNumericCode } from './token.service';

export type OtpPurposeName = 'login' | 'password_reset' | 'verify_email' | 'verify_mobile';

const OTP_EXPIRES_MS = 10 * 60 * 1000;
const GENERIC_OTP = 'Invalid or expired code';

/**
 * One-time password lifecycle shared by the cookie and bearer auth surfaces.
 *
 * Security properties:
 * - CSPRNG generated, six digits, hashed (keyed with SESSION_SECRET) at rest
 * - every confirmation attempt advances a counter, matched or not
 * - the purpose locks after AUTH_OTP_MAX_ATTEMPTS and all outstanding codes die
 * - at most AUTH_OTP_MAX_ACTIVE live codes per user/purpose
 * - comparisons are constant time
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async issue(input: {
    userId: string;
    purpose: OtpPurposeName;
    name: string;
    channel?: OtpChannel;
    email?: string | null;
    phone?: string | null;
  }) {
    const purpose = input.purpose as OtpPurpose;
    const channel = input.channel ?? OtpChannel.email;
    const recipient = channel === OtpChannel.email ? input.email : input.phone;
    if (!recipient) {
      throw new BadRequestException(
        channel === OtpChannel.email ? 'An email address is required' : 'A mobile number is required',
      );
    }
    const maxActive = this.config.get<number>('AUTH_OTP_MAX_ACTIVE', 3);

    const outstanding = await this.prisma.otpToken.findMany({
      where: { userId: input.userId, purpose, channel, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (outstanding.length >= maxActive) {
      await this.prisma.otpToken.updateMany({
        where: { id: { in: outstanding.slice(maxActive - 1).map((token) => token.id) } },
        data: { consumedAt: new Date() },
      });
    }

    const otp = randomNumericCode(6);
    await this.prisma.otpToken.create({
      data: {
        userId: input.userId,
        tokenHash: this.hash(input.userId, input.purpose, otp),
        purpose,
        channel,
        recipient,
        expiresAt: new Date(Date.now() + OTP_EXPIRES_MS),
      },
    });

    const templateKey = this.templateForPurpose(input.purpose);
    const payload = { name: input.name, otp, purpose: input.purpose };

    if (channel === OtpChannel.email) {
      await this.notifications.enqueueEmail({ templateKey, recipientEmail: recipient, payload });
    } else {
      await this.notifications.enqueueSms({
        templateKey,
        recipientPhone: recipient,
        payload,
        channel: channel === OtpChannel.whatsapp ? 'whatsapp' : 'sms',
      });
    }

    return { ok: true };
  }

  async verify(input: {
    userId: string;
    purpose: OtpPurposeName;
    otp: string;
    channel?: OtpChannel;
    email?: string | null;
    name?: string;
  }) {
    const channel = input.channel ?? OtpChannel.email;
    const maxAttempts = this.config.get<number>('AUTH_OTP_MAX_ATTEMPTS', 5);
    const activeTokens = await this.prisma.otpToken.findMany({
      where: {
        userId: input.userId,
        purpose: input.purpose as OtpPurpose,
        channel,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeTokens.length === 0) {
      throw new UnauthorizedException(GENERIC_OTP);
    }

    const now = new Date();
    const latest = activeTokens[0];
    const matches = constantTimeEquals(this.hash(input.userId, input.purpose, input.otp), latest.tokenHash);
    const expired = latest.expiresAt <= now;

    if (!matches || expired || latest.attempts >= maxAttempts) {
      const exhausted = latest.attempts + 1 >= maxAttempts;

      await this.prisma.otpToken.updateMany({
        where: { id: { in: activeTokens.map((token) => token.id) }, consumedAt: null },
        data: {
          attempts: { increment: 1 },
          ...(exhausted ? { consumedAt: now } : {}),
        },
      });

      if (exhausted) {
        await this.notifyExhausted({ email: input.email, name: input.name ?? 'there', purpose: input.purpose });
        await this.audit.record({
          actorUserId: null,
          actorRole: 'customer',
          entityType: 'otp_token',
          entityId: latest.id,
          action: 'customer.otp.locked',
          summary: `Invalidated ${input.purpose} codes after too many failed attempts`,
        });
      }

      throw new UnauthorizedException(GENERIC_OTP);
    }

    await this.prisma.otpToken.update({
      where: { id: latest.id },
      data: { consumedAt: now, attempts: { increment: 1 } },
    });

    const older = activeTokens.slice(1).map((token) => token.id);
    if (older.length > 0) {
      await this.prisma.otpToken.updateMany({ where: { id: { in: older } }, data: { consumedAt: now } });
    }

    return { consumedTokenId: latest.id };
  }

  /** Called after a purpose locks so the account holder learns about the attempt. */
  async notifyExhausted(input: { email?: string | null; name: string; purpose: OtpPurposeName }) {
    if (!input.email) {
      return;
    }
    await this.notifications.enqueueEmail({
      templateKey: 'customer_otp_attempts_exhausted',
      recipientEmail: input.email,
      payload: { name: input.name, purpose: input.purpose },
    });
  }

  private hash(userId: string, purpose: string, otp: string) {
    return hashToken(`${userId}:${purpose}:${otp}:${this.config.get<string>('SESSION_SECRET', 'local-session-secret-change-me')}`);
  }

  private templateForPurpose(purpose: OtpPurposeName) {
    switch (purpose) {
      case 'password_reset':
        return 'customer_password_reset_otp';
      case 'verify_email':
        return 'customer_verify_email_otp';
      case 'verify_mobile':
        return 'customer_verify_mobile_otp';
      default:
        return 'customer_login_otp';
    }
  }
}
