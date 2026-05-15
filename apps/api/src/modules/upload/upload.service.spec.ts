import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  it('rejects non-image uploads', () => {
    const config = { get: jest.fn(() => 1024) };
    const service = new UploadService(config as never, {} as never);

    expect(() =>
      service.validateImage({
        mimetype: 'application/pdf',
        size: 10,
      } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('rejects image uploads over the configured size', () => {
    const config = { get: jest.fn(() => 5) };
    const service = new UploadService(config as never, {} as never);

    expect(() =>
      service.validateImage({
        mimetype: 'image/png',
        size: 10,
      } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });
});
