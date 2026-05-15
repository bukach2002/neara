import { HealthService } from './health.service';

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
      MAILTRAP_USERNAME: '',
      MAILTRAP_PASSWORD: '',
      S3_BUCKET: '',
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
    });
    jest.spyOn(service as never, 'checkRedis').mockResolvedValue({ ok: true } as never);

    const result = await service.dependencies();

    expect(result.ok).toBe(false);
    expect(result.database).toEqual({ ok: true });
    expect(result.redis).toEqual({ ok: true });
    expect(result.email).toEqual({ ok: false, configured: false, error: 'Mailtrap credentials are not configured' });
    expect(result.storage).toEqual({ ok: false, configured: false, error: 'S3 storage credentials are not configured' });
  });

  it('aggregates all dependency probes into a healthy response', async () => {
    const { service } = setup();
    jest.spyOn(service as never, 'checkDatabase').mockResolvedValue({ ok: true } as never);
    jest.spyOn(service as never, 'checkRedis').mockResolvedValue({ ok: true } as never);
    jest.spyOn(service as never, 'checkEmail').mockResolvedValue({ ok: true, configured: true } as never);
    jest.spyOn(service as never, 'checkStorage').mockResolvedValue({ ok: true, configured: true, bucket: 'neara-s3' } as never);

    await expect(service.dependencies()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        database: { ok: true },
        redis: { ok: true },
        email: { ok: true, configured: true },
        storage: { ok: true, configured: true, bucket: 'neara-s3' },
        timestamp: expect.any(String),
      }),
    );
  });
});
