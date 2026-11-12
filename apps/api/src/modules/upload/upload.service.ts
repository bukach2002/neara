import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { put } from '@vercel/blob';
import { UploadedAssetOwnerType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type UploadImageInput = {
  tenantId: string;
  ownerType: UploadedAssetOwnerType;
  ownerId: string;
  folder: string;
  file: Express.Multer.File;
};

type SniffedImage = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  extension: '.jpg' | '.png' | '.webp' | '.gif';
};

/**
 * Only raster formats are accepted. SVG is deliberately excluded: it can carry
 * script and would be served from the blob host as an active document.
 */
@Injectable()
export class UploadService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadImage(input: UploadImageInput) {
    const sniffed = this.validateImage(input.file);

    const pathname = this.objectKey(input.folder, input.ownerId, sniffed);
    const token = this.config.get<string>('BLOB_READ_WRITE_TOKEN', '');

    const blob = await put(pathname, input.file.buffer, {
      access: 'public',
      contentType: sniffed.mimeType,
      ...(token ? { token } : {}),
    });

    const asset = await this.prisma.uploadedAsset.create({
      data: {
        tenantId: input.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        key: pathname,
        url: blob.url,
        mimeType: sniffed.mimeType,
        sizeBytes: input.file.size,
      },
    });

    return asset;
  }

  /**
   * Content-type and filename are attacker controlled. The stored type and the
   * object extension are therefore derived from the file signature only.
   */
  validateImage(file?: Express.Multer.File): SniffedImage {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Image file is required');
    }

    const maxBytes = this.config.get<number>('UPLOAD_MAX_IMAGE_BYTES', 4 * 1024 * 1024);
    if (file.size > maxBytes || file.buffer.length > maxBytes) {
      throw new BadRequestException(`Image must be ${maxBytes} bytes or smaller`);
    }

    const sniffed = sniffImageType(file.buffer);
    if (!sniffed) {
      throw new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed');
    }

    return sniffed;
  }

  private objectKey(folder: string, ownerId: string, sniffed: SniffedImage) {
    return `${folder}/${ownerId}/${randomUUID()}${sniffed.extension}`;
  }
}

export function sniffImageType(buffer: Buffer): SniffedImage | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: '.jpg' };
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: '.png' };
  }

  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString('ascii');
    if (header === 'GIF87a' || header === 'GIF89a') {
      return { mimeType: 'image/gif', extension: '.gif' };
    }
  }

  if (buffer.length >= 12) {
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    if (riff === 'RIFF' && webp === 'WEBP') {
      return { mimeType: 'image/webp', extension: '.webp' };
    }
  }

  return null;
}
