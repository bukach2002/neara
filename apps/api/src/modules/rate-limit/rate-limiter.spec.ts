import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { RateLimiter } from './rate-limiter';

function setup() {
  const config = new ConfigService({
    NODE_ENV: 'test',
    ALLOW_IN_MEMORY_RATE_LIMIT: 'true',
    RATE_LIMIT_ADMIN_LOGIN_PER_WINDOW: 2,
    RATE_LIMIT_WINDOW_SECONDS: 60,
  } as never);
  const logger = { event: jest.fn() };
  return new RateLimiter(config, logger as never);
}

function fakeRequest(ip: string, forwardedFor?: string) {
  return {
    ip,
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

function fakeResponse() {
  return { setHeader: jest.fn() } as unknown as Response;
}

async function call(limiter: RateLimiter, request: Request) {
  const next = jest.fn();
  await limiter.middleware('ADMIN_LOGIN')(request, fakeResponse(), next as unknown as NextFunction);
  return next;
}

describe('RateLimiter', () => {
  it('keys the limit on the resolved client address, not a client supplied header', async () => {
    const limiter = setup();

    // Rotating X-Forwarded-For must not reset the counter.
    const first = await call(limiter, fakeRequest('203.0.113.10', '198.51.100.1'));
    const second = await call(limiter, fakeRequest('203.0.113.10', '198.51.100.2'));
    const third = await call(limiter, fakeRequest('203.0.113.10', '198.51.100.3'));

    expect(first).toHaveBeenCalledWith();
    expect(second).toHaveBeenCalledWith();
    const blocked = third.mock.calls[0][0];
    expect(blocked).toBeInstanceOf(HttpException);
    expect((blocked as HttpException).getStatus()).toBe(429);
    expect((blocked as HttpException).getResponse()).toEqual(
      expect.objectContaining({ retryAfter: expect.any(Number) }),
    );
  });

  it('gives each resolved address its own budget', async () => {
    const limiter = setup();

    await call(limiter, fakeRequest('203.0.113.10'));
    await call(limiter, fakeRequest('203.0.113.10'));
    const otherAddress = await call(limiter, fakeRequest('203.0.113.11'));

    expect(otherAddress).toHaveBeenCalledWith();
  });

  it('applies an account-scoped limit across addresses', async () => {
    const limiter = setup();
    const keyOf = () => 'customer@example.com';

    const next = jest.fn();
    const middleware = limiter.middleware('ADMIN_LOGIN', keyOf);
    await middleware(fakeRequest('203.0.113.10'), fakeResponse(), next as unknown as NextFunction);
    await middleware(fakeRequest('203.0.113.11'), fakeResponse(), next as unknown as NextFunction);
    const third = jest.fn();
    await middleware(fakeRequest('203.0.113.12'), fakeResponse(), third as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(third.mock.calls[0][0]).toBeInstanceOf(HttpException);
  });

  it('refuses to boot in production without a shared store', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const config = new ConfigService({ NODE_ENV: 'production' } as never);
    const logger = { event: jest.fn() };

    try {
      expect(() => new RateLimiter(config, logger as never)).toThrow(/shared rate limit store/i);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
