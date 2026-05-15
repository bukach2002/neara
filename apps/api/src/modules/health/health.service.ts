import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Redis } from 'ioredis';
import nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

const DEPENDENCY_TIMEOUT_MS = 5000;

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
    const [database, redis, email, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkEmail(),
      this.checkStorage(),
    ]);

    return {
      ok: database.ok && redis.ok && email.ok && storage.ok,
      database,
      redis,
      email,
      storage,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase() {
    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`, 'Database health check timed out');
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
      await this.withTimeout(redis.connect(), 'Redis connection timed out');
      const pong = await this.withTimeout(redis.ping(), 'Redis ping timed out');
      return { ok: pong === 'PONG' };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    } finally {
      redis.disconnect();
    }
  }

  private async checkEmail() {
    const username = this.config.get<string>('MAILTRAP_USERNAME', '');
    const password = this.config.get<string>('MAILTRAP_PASSWORD', '');
    if (!username || !password) {
      return { ok: false, configured: false, error: 'Mailtrap credentials are not configured' };
    }

    const transporter = nodemailer.createTransport({
      host: this.config.get<string>('MAILTRAP_HOST', 'sandbox.smtp.mailtrap.io'),
      port: this.config.get<number>('MAILTRAP_PORT', 2525),
      secure: false,
      auth: {
        user: username,
        pass: password,
      },
    });

    try {
      await this.withTimeout(transporter.verify(), 'Email health check timed out');
      return { ok: true, configured: true };
    } catch (error) {
      return { ok: false, configured: true, error: this.errorMessage(error) };
    } finally {
      transporter.close();
    }
  }

  private async checkStorage() {
    const bucket = this.config.get<string>('S3_BUCKET', '');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID', '');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY', '');
    if (!bucket || !accessKeyId || !secretAccessKey) {
      return { ok: false, configured: false, error: 'S3 storage credentials are not configured' };
    }

    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const client = new S3Client({
      endpoint,
      region: this.config.get<string>('S3_REGION', 'ap-south-1'),
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    try {
      await this.withTimeout(client.send(new HeadBucketCommand({ Bucket: bucket })), 'S3 bucket health check timed out');
      return { ok: true, configured: true, bucket };
    } catch (error) {
      return { ok: false, configured: true, bucket, error: this.errorMessage(error) };
    } finally {
      client.destroy();
    }
  }

  private withTimeout<T>(promise: Promise<T>, message: string) {
    let timeout: NodeJS.Timeout;
    const timer = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), DEPENDENCY_TIMEOUT_MS);
    });

    return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown dependency error';
  }
}
