import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { RATE_LIMIT_METADATA_KEY, RateLimitBucket } from './rate-limit.constants';
import { RateLimitGuard } from './rate-limit.guard';

export function RateLimit(bucket: RateLimitBucket) {
  return applyDecorators(SetMetadata(RATE_LIMIT_METADATA_KEY, bucket), UseGuards(RateLimitGuard));
}
