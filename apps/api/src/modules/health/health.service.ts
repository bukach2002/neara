import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  basic() {
    return {
      ok: true,
      service: 'neara-api',
      timestamp: new Date().toISOString(),
    };
  }

  async dependencies() {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();

    return {
      ok: database.ok && redis.ok,
      database,
      redis,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  private async checkRedis() {
    const redis = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      return { ok: pong === 'PONG' };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    } finally {
      redis.disconnect();
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown dependency error';
  }
}
