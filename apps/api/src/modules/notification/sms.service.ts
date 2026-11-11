import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../observability/structured-logger.service';

export type SmsChannel = 'sms' | 'whatsapp';

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';

/**
 * SMS / WhatsApp delivery over the Twilio REST API.
 *
 * Only `fetch` is used, matching the rest of the codebase (no provider SDK).
 * WhatsApp is the safer default in markets where SMS needs DLT/template
 * registration, so both channels share one adapter.
 */
@Injectable()
export class SmsService {
  constructor(
    private readonly config: ConfigService,
    private readonly logger?: StructuredLoggerService,
  ) {}

  provider() {
    return this.config.get<string>('SMS_PROVIDER', 'disabled');
  }

  isConfigured(channel: SmsChannel) {
    return Boolean(
      this.provider() === 'twilio' &&
        this.config.get<string>('TWILIO_ACCOUNT_SID', '') &&
        this.config.get<string>('TWILIO_AUTH_TOKEN', '') &&
        this.fromNumber(channel),
    );
  }

  async send(input: { to: string; body: string; channel: SmsChannel }) {
    if (!this.isConfigured(input.channel)) {
      // Never pretend a code was delivered when no provider is wired up.
      throw new ServiceUnavailableException('SMS verification is not available right now');
    }

    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID', '');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN', '');
    const from = this.fromNumber(input.channel) as string;
    const to = input.channel === 'whatsapp' ? `whatsapp:${input.to}` : input.to;

    const body = new URLSearchParams({
      To: to,
      From: input.channel === 'whatsapp' ? `whatsapp:${from}` : from,
      Body: input.body,
    });

    const response = await fetch(`${TWILIO_API}/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger?.event('error', 'notification.sms.failed', 'Provider rejected an SMS message', {
        channel: input.channel,
        status: response.status,
        providerMessage: detail.slice(0, 240),
      });
      throw new ServiceUnavailableException('Could not send the verification code. Try again shortly.');
    }

    const payload = (await response.json().catch(() => ({}))) as { sid?: string };
    this.logger?.event('info', 'notification.sms.sent', 'SMS message accepted by provider', {
      channel: input.channel,
      messageId: payload.sid,
    });

    return { provider: 'twilio', messageId: payload.sid ?? null };
  }

  private fromNumber(channel: SmsChannel) {
    return this.config.get<string>(
      channel === 'whatsapp' ? 'TWILIO_WHATSAPP_FROM' : 'TWILIO_SMS_FROM',
      '',
    );
  }
}
