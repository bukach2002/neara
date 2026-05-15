import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { UploadedAssetOwnerType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';

type UploadImageInput = {
  tenantId: string;
  ownerType: UploadedAssetOwnerType;
  ownerId: string;
  folder: string;
  file: Express.Multer.File;
};

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Injectable()
export class UploadService {
  private s3?: S3Client;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadImage(input: UploadImageInput) {
    this.validateImage(input.file);

    const key = this.objectKey(input.folder, input.ownerId, input.file);
    await this.client().send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        Body: input.file.buffer,
        ContentType: input.file.mimetype,
      }),
    );

    const url = this.publicUrl(key);
    const asset = await this.prisma.uploadedAsset.create({
      data: {
        tenantId: input.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        key,
        url,
        mimeType: input.file.mimetype,
        sizeBytes: input.file.size,
      },
    });

    return asset;
  }

  validateImage(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed');
    }

    const maxBytes = this.config.get<number>('UPLOAD_MAX_IMAGE_BYTES', 5 * 1024 * 1024);
    if (file.size > maxBytes) {
      throw new BadRequestException(`Image must be ${maxBytes} bytes or smaller`);
    }
  }

  private client() {
    if (!this.s3) {
      const endpoint = this.config.get<string>('S3_ENDPOINT');
      this.s3 = new S3Client({
        endpoint,
        region: this.config.get<string>('S3_REGION', 'ap-south-1'),
        forcePathStyle: Boolean(endpoint),
        credentials: {
          accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID', ''),
          secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY', ''),
        },
      });
    }
    return this.s3;
  }

  private objectKey(folder: string, ownerId: string, file: Express.Multer.File) {
    const extension = this.extensionFor(file);
    return `${folder}/${ownerId}/${randomUUID()}${extension}`;
  }

  private extensionFor(file: Express.Multer.File) {
    const existing = extname(file.originalname || '').toLowerCase();
    if (existing && existing.length <= 8) {
      return existing;
    }

    switch (file.mimetype) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'image/gif':
        return '.gif';
      default:
        return '';
    }
  }

  private bucket() {
    return this.config.get<string>('S3_BUCKET', 'neara-local');
  }

  private publicUrl(key: string) {
    const baseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL');
    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, '')}/${key}`;
    }
    return `s3://${this.bucket()}/${key}`;
  }
}
