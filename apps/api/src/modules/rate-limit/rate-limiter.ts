import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextFunction, Request, Response } from 'express';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { RATE_LIMIT_ENV, RateLimitBucket } from './rate-limit.constants';

type Counter = { count: number; resetAt: number };

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function defaultRateLimit(bucket: RateLimitBucket) {
  switch (bucket) {
    case 'PUBLIC_SEARCH':
      return 100;
    case 'PUBLIC_SLOT_LOOKUP':
      return 120;
    case 'PUBLIC_BOOKING_CREATE':
      return 20;
    case 'PUBLIC_BOOKING_LOOKUP':
      return 30;
    case 'ADMIN_LOGIN':
      return 10;
    case 'PASSWORD_RESET':
      return 5;
    case 'CUSTOMER_REGISTER':
      return 10;
    case 'CUSTOMER_LOGIN':
      return 10;
    case 'CUSTOMER_OTP_REQUEST':
      return 5;
    case 'CUSTOMER_OTP_CONFIRM':
      return 20;
    case 'TENANT_SIGNUP':
      return 20;
    case 'CLIENT_EVENTS':
      return 60;
    case 'MOBILE_AUTH':
      return 20;
    case 'MOBILE_REFRESH':
      return 60;
  }
}

export function windowSecondsFor(config: ConfigService, bucket: RateLimitBucket) {
  if (bucket === 'PASSWORD_RESET' || bucket === 'CUSTOMER_OTP_REQUEST' || bucket === 'TENANT_SIGNUP') {
    return 60 * 60;
  }
  return config.get<number>('RATE_LIMIT_WINDOW_SECONDS', 60);
}

/**
 * Shared rate limiter.
 *
 * - the client key is derived from Express's parsed address (trust proxy), never
 *   from a raw client supplied header
 * - a second, account-scoped key is available for auth and lookup endpoints
 * - in production a shared store is mandatory (fail closed, never in-memory)
 * - a 429 carries Retry-After and standard rate-limit headers
 */
export class RateLimiter {
  private readonly mode: 'upstash' | 'memory';
  private readonly counters = new Map<string, Counter>();
  private readonly ratelimits = new Map<string, Ratelimit>();
  private readonly redis?: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    const upstashUrl = config.get<string>('UPSTASH_REDIS_REST_URL', '');
    const upstashToken = config.get<string>('UPSTASH_REDIS_REST_TOKEN', '');
    const production = ['production', 'staging'].includes(config.get<string>('NODE_ENV', 'development'));
    const allowInMemory = config.get<string>('ALLOW_IN_MEMORY_RATE_LIMIT', 'false') === 'true';

    if (upstashUrl && upstashToken) {
      this.redis = new Redis({ url: upstashUrl, token: upstashToken });
      this.mode = 'upstash';
      this.logger.event('info', 'rate_limit.mode', 'Using Upstash rate limiter');
      return;
    }

    if ((production || config.get<string>('RATE_LIMIT_REQUIRE_SHARED_STORE', 'false') === 'true') && !allowInMemory) {
      throw new Error(
        'A shared rate limit store is required in production. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
      );
    }

    this.mode = 'memory';
    this.logger.event('info', 'rate_limit.mode', 'Using in-memory rate limiter (not for multi-instance deployments)');
  }

  /** Express `trust proxy` handles forwarded headers; never parse XFF by hand. */
  clientKey(request: Request) {
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  async consume(input: { bucket: RateLimitBucket; key: string; scope?: string; limit?: number; windowSeconds?: number }): Promise<RateLimitResult> {
    const limit = input.limit ?? this.config.get<number>(RATE_LIMIT_ENV[input.bucket], defaultRateLimit(input.bucket));
    const windowSeconds = input.windowSeconds ?? windowSecondsFor(this.config, input.bucket);
    const key = `${input.scope ?? 'ip'}:${input.key}`;

    if (this.mode === 'upstash' && this.redis) {
      try {
        const cacheKey = `${input.bucket}:${key}`;
        let limiter = this.ratelimits.get(cacheKey);
        if (!limiter) {
          limiter = new Ratelimit({
            redis: this.redis,
            limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
            prefix: `neara:${input.bucket}:${input.scope ?? 'ip'}`,
          });
          this.ratelimits.set(cacheKey, limiter);
        }

        const result = await limiter.limit(input.key);
        return {
          success: result.success,
          limit,
          remaining: result.remaining,
          resetAt: result.reset,
        };
      } catch (error) {
        this.logger.event('error', 'rate_limit.store_error', error instanceof Error ? error.message : 'Shared rate limit store unavailable');
        // Fail closed: do not silently degrade to unlimited traffic.
        throw new HttpException({ message: 'Service temporarily unavailable. Try again shortly.' }, 503);
      }
    }

    const now = Date.now();
    const namespacedKey = `${input.bucket}:${key}`;
    const windowMs = windowSeconds * 1000;
    const counter = this.counters.get(namespacedKey);

    if (!counter || counter.resetAt <= now) {
      this.counters.set(namespacedKey, { count: 1, resetAt: now + windowMs });
      return { success: true, limit, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
    }

    if (counter.count >= limit) {
      return { success: false, limit, remaining: 0, resetAt: counter.resetAt };
    }

    counter.count += 1;
    return { success: true, limit, remaining: Math.max(0, limit - counter.count), resetAt: counter.resetAt };
  }

  /**
   * Middleware for an IP-keyed limit. Pass `keyOf` for an account-scoped limit
   * (for example the submitted email or booking reference).
   */
  middleware(bucket: RateLimitBucket, keyOf?: (request: Request) => string | undefined) {
    return async (request: Request, response: Response, next: NextFunction) => {
      try {
        const rawKey = keyOf ? keyOf(request) : this.clientKey(request);
        if (!rawKey) {
          next();
          return;
        }

        const result = await this.consume({ bucket, key: rawKey, scope: keyOf ? 'account' : 'ip' });
        this.applyHeaders(response, result);

        if (!result.success) {
          const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
          response.setHeader('retry-after', String(retryAfter));
          next(this.tooManyRequests(result, retryAfter));
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  applyHeaders(response: Response, result: RateLimitResult) {
    response.setHeader('x-ratelimit-limit', String(result.limit));
    response.setHeader('x-ratelimit-remaining', String(result.remaining));
    response.setHeader('x-ratelimit-reset', String(Math.ceil(result.resetAt / 1000)));
  }

  tooManyRequests(result: RateLimitResult, retryAfter?: number) {
    const seconds = retryAfter ?? Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return new HttpException(
      {
        message: 'Too many attempts. Try again later.',
        retryAfter: seconds,
        resetAt: new Date(result.resetAt).toISOString(),
      },
      429,
    );
  }
}
