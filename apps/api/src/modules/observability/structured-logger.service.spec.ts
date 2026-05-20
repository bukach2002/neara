import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';

describe('StructuredLoggerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('redacts sensitive fields before writing JSON logs', () => {
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new StructuredLoggerService({
      get: jest.fn((key: string) => (key === 'LOG_LEVEL' ? 'debug' : 'development')),
    } as unknown as ConfigService);

    logger.event('info', 'test.event', 'Test message', {
      requestId: 'req-1',
      password: 'secret',
      nested: { authorization: 'Bearer token', safe: 'ok' },
    });

    const payload = JSON.parse(stdout.mock.calls[0][0] as string);
    expect(payload).toEqual(expect.objectContaining({
      level: 'info',
      service: 'neara-api',
      event: 'test.event',
      message: 'Test message',
      requestId: 'req-1',
      password: '[redacted]',
      nested: { authorization: '[redacted]', safe: 'ok' },
    }));
  });

  it('honours configured log level filtering', () => {
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new StructuredLoggerService({
      get: jest.fn((key: string) => (key === 'LOG_LEVEL' ? 'warn' : 'production')),
    } as unknown as ConfigService);

    logger.event('info', 'test.info', 'Suppressed');
    logger.event('warn', 'test.warn', 'Written');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stderr.mock.calls[0][0] as string)).toEqual(expect.objectContaining({
      level: 'warn',
      event: 'test.warn',
    }));
  });

  it('redacts unsafe client payload data when requested', () => {
    const logger = new StructuredLoggerService({
      get: jest.fn(() => 'debug'),
    } as unknown as ConfigService);

    expect(logger.redactUnsafeClientContext({
      email: 'customer@example.com',
      phone: '+919876543210',
      path: '/search',
      nested: { token: 'abc', message: 'safe-ish' },
    })).toEqual({
      email: '[redacted]',
      phone: '[redacted]',
      path: '/search',
      nested: { token: '[redacted]', message: 'safe-ish' },
    });
  });
});
