import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  it('rejects requests after the configured limit', async () => {
    const config = { get: jest.fn((key: string) => (key === 'RATE_LIMIT_PUBLIC_SEARCH_PER_MINUTE' ? 2 : 60)) } as unknown as ConfigService;
    const reflector = {
      getAllAndOverride: jest.fn(() => 'PUBLIC_SEARCH'),
    } as unknown as Reflector;
    const guard = new RateLimitGuard(config, reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          header: () => undefined,
          socket: {},
        }),
      }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toThrow(/Rate limit exceeded/);
  });
});
