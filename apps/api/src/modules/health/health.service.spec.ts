import { HealthService } from './health.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

function setup(configValues: Record<string, unknown> = {}) {
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => (key in configValues ? configValues[key] : fallback)),
  };
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
  };
  const service = new HealthService(config as never, prisma as never);
  return { config, prisma, service };
}

describe('HealthService dependencies', () => {
  it('marks dependency health false when email and storage are not configured', async () => {
    const { service } = setup({
      REDIS_URL: 'redis://localhost:6379',
      RESEND_API_KEY: '',
      BLOB_READ_WRITE_TOKEN: '',
    });
    jest.spyOn(service as never, 'checkRedis').mockResolvedValue({ ok: true } as never);

    const result = await service.dependencies();

    expect(result.ok).toBe(false);
    expect(result.database).toEqual({ ok: true });
    expect(result.redis).toEqual({ ok: true });
    expect(result.email).toEqual({ ok: false, configured: false, error: 'Resend API key is not configured' });
    expect(result.storage).toEqual({ ok: false, configured: false, error: 'Vercel Blob token is not configured' });
  });

  it('verifies the configured Resend SMTP connection', async () => {
    const verify = jest.fn().mockResolvedValue(true);
    const close = jest.fn();
    const createTransport = nodemailer.createTransport as jest.Mock;
    createTransport.mockReturnValue({ verify, close });
    const { service } = setup({
      RESEND_API_KEY: 'test-api-key',
      RESEND_SMTP_HOST: 'smtp.resend.com',
      RESEND_SMTP_PORT: 465,
    });
    jest.spyOn(service as never, 'checkDatabase').mockResolvedValue({ ok: true } as never);
    jest.spyOn(service as never, 'checkRedis').mockResolvedValue({ ok: true } as never);
    jest.spyOn(service as never, 'checkStorage').mockResolvedValue({ ok: true, configured: true } as never);

    const result = await service.dependencies();

    expect(result.email).toEqual({ ok: true, configured: true });
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: 'test-api-key' },
    });
    expect(verify).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('aggregates all dependency probes into a healthy response', async () => {
    const { service } = setup();
    jest.spyOn(service as never, 'checkDatabase').mockResolvedValue({ ok: true } as never);
    jest.spyOn(service as never, 'checkRedis').mockResolvedValue({ ok: true } as never);
    jest.spyOn(service as never, 'checkEmail').mockResolvedValue({ ok: true, configured: true } as never);
    jest.spyOn(service as never, 'checkStorage').mockResolvedValue({ ok: true, configured: true } as never);

    await expect(service.dependencies()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        database: { ok: true },
        redis: { ok: true },
        email: { ok: true, configured: true },
        storage: { ok: true, configured: true },
        timestamp: expect.any(String),
      }),
    );
  });
});
