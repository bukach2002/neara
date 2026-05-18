import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { RATE_LIMIT_ENV, RATE_LIMIT_METADATA_KEY, RateLimitBucket } from './rate-limit.constants';

type Counter = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();
  private redis?: Redis;
  private redisDisabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const bucket = this.reflector.getAllAndOverride<RateLimitBucket>(RATE_LIMIT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!bucket) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const key = `${bucket}:${this.clientKey(request)}`;
    const limit = this.limitFor(bucket);
    const windowMs = this.windowSecondsFor(bucket) * 1000;
    if (this.config.get<boolean>('RATE_LIMIT_REDIS_ENABLED', false)) {
      return this.canActivateWithRedis(key, limit, windowMs);
    }

    return this.canActivateInMemory(key, limit, windowMs);
  }

  private canActivateInMemory(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const counter = this.counters.get(key);

    if (!counter || counter.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (counter.count >= limit) {
      throw new HttpException({
        message: 'Rate limit exceeded',
        limit,
        resetAt: new Date(counter.resetAt).toISOString(),
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    counter.count += 1;
    return true;
  }

  private async canActivateWithRedis(key: string, limit: number, windowMs: number) {
    if (this.redisDisabled) {
      return this.canActivateInMemory(key, limit, windowMs);
    }

    try {
      const redis = this.getRedis();
      const redisKey = `rate-limit:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.pexpire(redisKey, windowMs);
      }
      if (count > limit) {
        const ttl = await redis.pttl(redisKey);
        const resetAt = Date.now() + Math.max(ttl, 0);
        throw new HttpException({
          message: 'Rate limit exceeded',
          limit,
          resetAt: new Date(resetAt).toISOString(),
        }, HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.redisDisabled = true;
      return this.canActivateInMemory(key, limit, windowMs);
    }
  }

  private getRedis() {
    if (!this.redis) {
      this.redis = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      this.redis.on('error', () => {
        this.redisDisabled = true;
      });
    }
    return this.redis;
  }

  private limitFor(bucket: RateLimitBucket) {
    return this.config.get<number>(RATE_LIMIT_ENV[bucket], this.defaultLimit(bucket));
  }

  private windowSecondsFor(bucket: RateLimitBucket) {
    if (bucket === 'PASSWORD_RESET' || bucket === 'CUSTOMER_OTP_REQUEST') {
      return 60 * 60;
    }
    return this.config.get<number>('RATE_LIMIT_WINDOW_SECONDS', 60);
  }

  private defaultLimit(bucket: RateLimitBucket) {
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
    }
  }

  private clientKey(request: Request) {
    const forwardedFor = request.header('x-forwarded-for')?.split(',')[0]?.trim();
    return forwardedFor || request.ip || request.socket.remoteAddress || 'unknown';
  }
}
