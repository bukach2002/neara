import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, generateTotpSecret, verifyTotp } from './token.service';

/**
 * TOTP multi-factor authentication for admin accounts.
 *
 * Enrollment is deliberate and two-step: `beginEnrollment` stores an encrypted
 * (not yet active) seed, and only `confirmEnrollment` with a valid code enables
 * MFA. Once enabled, every admin/customer-admin login requires a code.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private secret() {
    return this.config.get<string>('SESSION_SECRET', 'local-session-secret-change-me');
  }

  async beginEnrollment(userId: string, accountLabel: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Account not found');
    }
    if (user.mfaEnabledAt) {
      throw new BadRequestException('Multi-factor authentication is already enabled');
    }

    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretCiphertext: encryptSecret(secret, this.secret()) },
    });

    const issuer = 'Neara';
    const label = encodeURIComponent(`${issuer}:${accountLabel}`);
    return {
      secret,
      otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`,
    };
  }

  async confirmEnrollment(userId: string, code: string, sourceIp?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const secret = user?.mfaSecretCiphertext ? decryptSecret(user.mfaSecretCiphertext, this.secret()) : null;

    if (!user || !secret) {
      throw new BadRequestException('Start multi-factor enrollment first');
    }
    if (!verifyTotp(secret, code)) {
      await this.audit.record({
        actorUserId: userId,
        actorRole: 'self',
        entityType: 'user',
        entityId: userId,
        action: 'mfa.enrollment.failed',
        summary: 'Rejected an invalid MFA enrollment code',
        sourceIp,
      });
      throw new BadRequestException('That code is not valid. Check your authenticator app and try again.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabledAt: new Date() },
    });

    await this.audit.record({
      actorUserId: userId,
      actorRole: 'self',
      entityType: 'user',
      entityId: userId,
      action: 'mfa.enabled',
      summary: 'Enabled TOTP multi-factor authentication',
      sourceIp,
    });

    return { enabled: true };
  }

  async disable(userId: string, code: string, sourceIp?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const secret = user?.mfaSecretCiphertext ? decryptSecret(user.mfaSecretCiphertext, this.secret()) : null;

    if (!user || !secret || !user.mfaEnabledAt) {
      throw new BadRequestException('Multi-factor authentication is not enabled');
    }
    if (!verifyTotp(secret, code)) {
      throw new BadRequestException('That code is not valid. Check your authenticator app and try again.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretCiphertext: null, mfaEnabledAt: null },
    });

    await this.audit.record({
      actorUserId: userId,
      actorRole: 'self',
      entityType: 'user',
      entityId: userId,
      action: 'mfa.disabled',
      summary: 'Disabled TOTP multi-factor authentication',
      sourceIp,
    });

    return { enabled: false };
  }
}
