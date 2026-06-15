import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { put } from '@vercel/blob';
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
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadImage(input: UploadImageInput) {
    this.validateImage(input.file);

    const pathname = this.objectKey(input.folder, input.ownerId, input.file);
    const token = this.config.get<string>('BLOB_READ_WRITE_TOKEN', '');

    const blob = await put(pathname, input.file.buffer, {
      access: 'public',
      ...(token ? { token } : {}),
    });

    const asset = await this.prisma.uploadedAsset.create({
      data: {
        tenantId: input.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        key: pathname,
        url: blob.url,
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

    const maxBytes = this.config.get<number>('UPLOAD_MAX_IMAGE_BYTES', 4 * 1024 * 1024);
    if (file.size > maxBytes) {
      throw new BadRequestException(`Image must be ${maxBytes} bytes or smaller`);
    }
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
}
