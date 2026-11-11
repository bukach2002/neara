import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { inngest } from './inngest.client';
import { BookingStatus, NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService, type SmsChannel } from './sms.service';

type EmailNotificationInput = {
  tenantId?: string | null;
  templateKey: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  payload: Prisma.InputJsonValue;
};

type BookingNotificationInput = {
  tenantId: string;
  bookingId: string;
  bookingReference: string;
  customerEmail?: string | null;
  customerName: string;
  tenantName: string;
  serviceName: string;
  expertName: string;
  displayTime: string;
  tenantAdminEmails?: string[];
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly logger?: StructuredLoggerService,
    @Optional()
    private readonly sms?: SmsService,
  ) {}

  async enqueueBookingCreated(input: BookingNotificationInput) {
    const jobs: Array<Promise<unknown>> = [];

    if (input.customerEmail) {
      jobs.push(
        this.enqueueEmail({
          tenantId: input.tenantId,
          templateKey: 'booking_confirmation_customer',
          recipientEmail: input.customerEmail,
          payload: this.asJson(input),
        }),
      );
    }

    for (const tenantAdminEmail of input.tenantAdminEmails ?? []) {
      jobs.push(
        this.enqueueEmail({
          tenantId: input.tenantId,
          templateKey: 'booking_confirmation_tenant_admin',
          recipientEmail: tenantAdminEmail,
          payload: this.asJson(input),
        }),
      );
    }

    await Promise.allSettled(jobs);
  }

  async enqueueBookingCancelled(input: BookingNotificationInput) {
    if (!input.customerEmail) {
      return;
    }

    await this.enqueueEmail({
      tenantId: input.tenantId,
      templateKey: 'booking_cancellation_customer',
      recipientEmail: input.customerEmail,
      payload: this.asJson(input),
    });
  }

  async enqueueDueReminders(now = new Date()) {
    const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.confirmed,
        startsAt: { gte: windowStart, lt: windowEnd },
        customerEmailSnapshot: { not: null },
      },
      include: {
        tenant: {
          include: {
            memberships: {
              where: { role: { in: ['owner', 'admin'] } },
              include: { user: true },
            },
          },
        },
      },
    });

    let enqueued = 0;
    for (const booking of bookings) {
      const existing = await this.prisma.notificationLog.findFirst({
        where: {
          tenantId: booking.tenantId,
          templateKey: 'booking_reminder_customer',
          payload: { path: ['bookingId'], equals: booking.id },
        },
      });

      if (existing) {
        continue;
      }

      await this.enqueueEmail({
        tenantId: booking.tenantId,
        templateKey: 'booking_reminder_customer',
        recipientEmail: booking.customerEmailSnapshot,
        payload: this.asJson({
          tenantId: booking.tenantId,
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          customerEmail: booking.customerEmailSnapshot,
          customerName: booking.customerNameSnapshot,
          tenantName: booking.tenantNameSnapshot,
          serviceName: booking.serviceNameSnapshot,
          expertName: booking.expertDisplayNameSnapshot,
          displayTime: booking.displayTimeSnapshot,
        }),
      });
      enqueued += 1;
    }

    return { scanned: bookings.length, enqueued, windowStart, windowEnd };
  }

  async enqueueEmail(input: EmailNotificationInput) {
    const log = await this.prisma.notificationLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        channel: NotificationChannel.email,
        templateKey: input.templateKey,
        provider: 'resend',
        status: NotificationStatus.queued,
        recipientEmail: input.recipientEmail,
        recipientPhone: input.recipientPhone,
        payload: input.payload,
      },
    });
    this.logger?.event('info', 'notification.email.queued', 'Email notification log queued', {
      notificationLogId: log.id,
      tenantId: log.tenantId,
      templateKey: log.templateKey,
    });

    try {
      await this.sendInngestEvent(log.id);
      this.logger?.event('info', 'notification.email.enqueued', 'Email notification enqueued via Inngest', {
        notificationLogId: log.id,
        tenantId: log.tenantId,
        templateKey: log.templateKey,
      });
    } catch (error) {
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.failed,
          errorMessage: error instanceof Error ? error.message : 'Failed to enqueue notification',
          attempts: { increment: 1 },
        },
      });
      this.logger?.event('error', 'notification.email.enqueue_failed', error instanceof Error ? error.message : 'Failed to enqueue notification', {
        notificationLogId: log.id,
        tenantId: log.tenantId,
        templateKey: log.templateKey,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    return log;
  }

  /**
   * SMS/WhatsApp is sent inline rather than through Inngest: verification codes
   * are useless if a queued retry lands minutes later, and the caller must learn
   * immediately when no provider is configured.
   */
  async enqueueSms(input: {
    tenantId?: string | null;
    templateKey: string;
    recipientPhone: string;
    payload: Prisma.InputJsonValue;
    channel: SmsChannel;
  }) {
    const log = await this.prisma.notificationLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        channel: input.channel === 'whatsapp' ? NotificationChannel.whatsapp : NotificationChannel.sms,
        templateKey: input.templateKey,
        provider: this.sms?.provider() ?? null,
        status: NotificationStatus.queued,
        recipientPhone: input.recipientPhone,
        payload: input.payload,
      },
    });

    if (!this.sms) {
      throw new Error('SMS delivery is not configured');
    }

    try {
      const result = await this.sms.send({
        to: input.recipientPhone,
        body: this.renderTemplate(input.templateKey, input.payload as Prisma.JsonValue).text,
        channel: input.channel,
      });

      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.sent,
          provider: result.provider,
          sentAt: new Date(),
          attempts: { increment: 1 },
          errorMessage: null,
        },
      });
      this.logger?.event('info', 'notification.sms.sent', 'SMS notification sent', {
        notificationLogId: log.id,
        tenantId: log.tenantId,
        templateKey: log.templateKey,
        channel: input.channel,
      });

      return log;
    } catch (error) {
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.failed,
          attempts: { increment: 1 },
          errorMessage: error instanceof Error ? error.message : 'SMS send failed',
        },
      });
      this.logger?.event('error', 'notification.sms.failed', error instanceof Error ? error.message : 'SMS send failed', {
        notificationLogId: log.id,
        tenantId: log.tenantId,
        templateKey: log.templateKey,
        channel: input.channel,
      });
      throw error;
    }
  }

  async sendInngestEvent(notificationLogId: string) {
    await inngest.send({
      name: 'notification/send-email',
      data: { notificationLogId },
    });
  }

  async processEmailNotification(notificationLogId: string) {
    const log = await this.prisma.notificationLog.findUnique({ where: { id: notificationLogId } });
    if (!log || log.channel !== NotificationChannel.email || !log.recipientEmail) {
      return;
    }

    const template = this.renderTemplate(log.templateKey, log.payload);
    await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: NotificationStatus.sending, attempts: { increment: 1 } },
    });
    this.logger?.event('info', 'notification.email.sending', 'Email notification sending', {
      notificationLogId: log.id,
      tenantId: log.tenantId,
      templateKey: log.templateKey,
    });

    const mailer = this.mailer();
    try {
      await mailer.sendMail({
        from: this.config.get<string>('MAIL_FROM', 'no-reply@neara.local'),
        to: log.recipientEmail,
        subject: template.subject,
        text: template.text,
      });

      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.sent, sentAt: new Date(), errorMessage: null },
      });
      this.logger?.event('info', 'notification.email.sent', 'Email notification sent', {
        notificationLogId: log.id,
        tenantId: log.tenantId,
        templateKey: log.templateKey,
      });
    } catch (error) {
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: log.attempts >= 2 ? NotificationStatus.permanently_failed : NotificationStatus.failed,
          errorMessage: error instanceof Error ? error.message : 'Email send failed',
          nextAttemptAt: log.attempts >= 2 ? null : new Date(Date.now() + 30_000 * Math.pow(2, log.attempts)),
        },
      });
      this.logger?.event('error', 'notification.email.failed', error instanceof Error ? error.message : 'Email send failed', {
        notificationLogId: log.id,
        tenantId: log.tenantId,
        templateKey: log.templateKey,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      mailer.close();
    }
  }

  async queueStats() {
    return {
      ok: true,
      provider: 'inngest',
      message: 'Notifications are processed via Inngest. Visit the Inngest dashboard for queue details.',
    };
  }

  private mailer() {
    const port = this.config.get<number>('RESEND_SMTP_PORT', 465);
    return nodemailer.createTransport({
      host: this.config.get<string>('RESEND_SMTP_HOST', 'smtp.resend.com'),
      port,
      secure: port === 465,
      auth: {
        user: 'resend',
        pass: this.config.get<string>('RESEND_API_KEY', ''),
      },
    });
  }

  private renderTemplate(templateKey: string, payload: Prisma.JsonValue | null) {
    const data = this.payload(payload);
    const common = `${data.serviceName ?? 'Appointment'} with ${data.expertName ?? 'your expert'} at ${data.displayTime ?? 'the selected time'}`;

    if (templateKey === 'booking_cancellation_customer') {
      return {
        subject: `Booking cancelled: ${data.bookingReference ?? ''}`.trim(),
        text: `Hi ${data.customerName ?? 'there'}, your booking ${data.bookingReference ?? ''} for ${common} has been cancelled.`,
      };
    }

    if (templateKey === 'booking_confirmation_tenant_admin') {
      return {
        subject: `New booking: ${data.bookingReference ?? ''}`.trim(),
        text: `New booking ${data.bookingReference ?? ''}: ${data.customerName ?? 'Customer'} booked ${common}.`,
      };
    }

    if (templateKey === 'booking_reminder_customer') {
      return {
        subject: `Reminder: ${data.bookingReference ?? 'your booking'}`.trim(),
        text: `Hi ${data.customerName ?? 'there'}, this is a reminder for booking ${data.bookingReference ?? ''}: ${common}.`,
      };
    }

    if (templateKey === 'admin_password_reset') {
      return {
        subject: 'Reset your Neara admin password',
        text: `Hi ${data.name ?? 'there'}, reset your Neara admin password here: ${data.resetUrl ?? ''}`,
      };
    }

    if (templateKey === 'customer_login_otp') {
      return {
        subject: 'Your Neara login code',
        text: `Hi ${data.name ?? 'there'}, your Neara login code is ${data.otp ?? ''}. It expires in 10 minutes.`,
      };
    }

    if (templateKey === 'customer_password_reset_otp') {
      return {
        subject: 'Your Neara password reset code',
        text: `Hi ${data.name ?? 'there'}, your Neara password reset code is ${data.otp ?? ''}. It expires in 10 minutes.`,
      };
    }

    if (templateKey === 'customer_verify_email_otp') {
      return {
        subject: 'Verify your Neara email address',
        text: `Hi ${data.name ?? 'there'}, your Neara email verification code is ${data.otp ?? ''}. It expires in 10 minutes.`,
      };
    }

    if (templateKey === 'customer_verify_mobile_otp') {
      return {
        subject: 'Verify your Neara mobile number',
        text: `Hi ${data.name ?? 'there'}, your Neara mobile verification code is ${data.otp ?? ''}. It expires in 10 minutes.`,
      };
    }

    if (templateKey === 'customer_otp_attempts_exhausted') {
      return {
        subject: 'Neara security alert: repeated incorrect codes',
        text: `Hi ${data.name ?? 'there'}, too many incorrect verification codes were entered for your Neara account. If this was not you, reset your password and contact support.`,
      };
    }

    if (templateKey === 'customer_password_changed') {
      return {
        subject: 'Your Neara password was changed',
        text: `Hi ${data.name ?? 'there'}, your Neara password was changed on ${data.changedAt ?? 'a recent date'}. All other sessions were signed out. If this was not you, reset your password immediately and contact support.`,
      };
    }

    return {
      subject: `Booking confirmed: ${data.bookingReference ?? ''}`.trim(),
      text: `Hi ${data.customerName ?? 'there'}, your booking ${data.bookingReference ?? ''} is confirmed for ${common}.`,
    };
  }

  private payload(payload: Prisma.JsonValue | null): Record<string, unknown> {
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  }

  private asJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
