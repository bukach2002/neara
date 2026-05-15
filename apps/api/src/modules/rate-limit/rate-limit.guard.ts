import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RATE_LIMIT_ENV, RATE_LIMIT_METADATA_KEY, RateLimitBucket } from './rate-limit.constants';

type Counter = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext) {
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

  private limitFor(bucket: RateLimitBucket) {
    return this.config.get<number>(RATE_LIMIT_ENV[bucket], this.defaultLimit(bucket));
  }

  private windowSecondsFor(bucket: RateLimitBucket) {
    if (bucket === 'PASSWORD_RESET') {
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
    }
  }

  private clientKey(request: Request) {
    const forwardedFor = request.header('x-forwarded-for')?.split(',')[0]?.trim();
    return forwardedFor || request.ip || request.socket.remoteAddress || 'unknown';
  }
}
