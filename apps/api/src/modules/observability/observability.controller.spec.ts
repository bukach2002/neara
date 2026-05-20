import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientEventDto } from './dto/client-event.dto';
import { ObservabilityController } from './observability.controller';

describe('ObservabilityController', () => {
  it('logs sanitized client events without persisting them', () => {
    const logger = {
      event: jest.fn(),
      redactUnsafeClientContext: jest.fn((context) => ({ ...context, email: '[redacted]' })),
    };
    const controller = new ObservabilityController(logger as never);

    expect(controller.recordClientEvent({
      event: 'api.request.failed',
      path: '/api/public/tenants',
      method: 'GET',
      status: 500,
      durationMs: 75,
      requestId: 'req-1',
      category: 'http_error',
      message: 'Request failed',
    }, {
      ip: '127.0.0.1',
      header: jest.fn(() => 'Mozilla/5.0'),
    } as never)).toEqual({ ok: true });

    expect(logger.event).toHaveBeenCalledWith(
      'warn',
      'client.event.received',
      'Request failed',
      expect.objectContaining({
        event: 'api.request.failed',
        path: '/api/public/tenants',
        requestId: 'req-1',
      }),
    );
  });

  it('rejects oversized client event payload fields through validation', async () => {
    const dto = plainToInstance(ClientEventDto, {
      event: 'x'.repeat(81),
      path: '/api/public/tenants',
      method: 'GET',
      status: 500,
      durationMs: 10,
    });

    await expect(validate(dto)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'event' }),
    ]));
  });
});
