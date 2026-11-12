import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

const CONFIGURED = {
  SMS_PROVIDER: 'twilio',
  TWILIO_ACCOUNT_SID: 'AC123',
  TWILIO_AUTH_TOKEN: 'token',
  TWILIO_SMS_FROM: '+15550001111',
  TWILIO_WHATSAPP_FROM: '+15550002222',
};

function setup(overrides: Record<string, string> = {}) {
  const config = new ConfigService({ ...CONFIGURED, ...overrides } as never);
  const logger = { event: jest.fn() };
  return { service: new SmsService(config, logger as never), logger };
}

describe('SmsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts an SMS to the Twilio REST API with basic auth', async () => {
    const { service } = setup();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ sid: 'SM123' }),
    } as never);

    await expect(
      service.send({ to: '+919876543210', body: 'Your Neara code is 123456', channel: 'sms' }),
    ).resolves.toEqual({ provider: 'twilio', messageId: 'SM123' });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from('AC123:token').toString('base64')}`,
    );
    const body = new URLSearchParams(String(init.body));
    expect(body.get('To')).toBe('+919876543210');
    expect(body.get('From')).toBe('+15550001111');
    expect(body.get('Body')).toBe('Your Neara code is 123456');
  });

  it('prefixes both numbers for WhatsApp', async () => {
    const { service } = setup();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ sid: 'SM456' }),
    } as never);

    await service.send({ to: '+919876543210', body: 'Code 123456', channel: 'whatsapp' });

    const body = new URLSearchParams(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body.get('To')).toBe('whatsapp:+919876543210');
    expect(body.get('From')).toBe('whatsapp:+15550002222');
  });

  it('refuses to send when the provider is disabled', async () => {
    const { service } = setup({ SMS_PROVIDER: 'disabled' });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(service.send({ to: '+919876543210', body: 'Code', channel: 'sms' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails loudly when Twilio rejects the message', async () => {
    const { logger, service } = setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"code":21608,"message":"unverified number"}',
    } as never);

    await expect(service.send({ to: '+919876543210', body: 'Code', channel: 'sms' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(logger.event).toHaveBeenCalledWith(
      'error',
      'notification.sms.failed',
      expect.any(String),
      expect.objectContaining({ channel: 'sms', status: 400 }),
    );
  });
});
