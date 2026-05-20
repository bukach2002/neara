import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { AUTH_CONTEXT_REQUEST_KEY } from '../auth/types';
import { RequestLoggingMiddleware } from './request-logging.middleware';

describe('RequestLoggingMiddleware', () => {
  function responseMock() {
    const emitter = new EventEmitter() as EventEmitter & Partial<Response>;
    emitter.statusCode = 200;
    emitter.setHeader = jest.fn();
    return emitter as Response & EventEmitter;
  }

  it('generates a request id, returns it as a header, and logs request completion', () => {
    const logger = { event: jest.fn() };
    const middleware = new RequestLoggingMiddleware(logger as never);
    const request = {
      method: 'GET',
      originalUrl: '/api/health',
      ip: '127.0.0.1',
      socket: {},
      header: jest.fn(() => undefined),
    } as unknown as Request;
    const response = responseMock();
    const next = jest.fn();

    middleware.use(request, response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(request.requestId).toEqual(expect.any(String));
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', request.requestId);
    expect(logger.event).toHaveBeenCalledWith(
      'info',
      'http.request.completed',
      'GET /api/health 200',
      expect.objectContaining({
        requestId: request.requestId,
        method: 'GET',
        path: '/api/health',
        statusCode: 200,
      }),
    );
  });

  it('preserves a trusted incoming request id and warns for notable 4xx responses', () => {
    const logger = { event: jest.fn() };
    const middleware = new RequestLoggingMiddleware(logger as never);
    const request = {
      method: 'POST',
      originalUrl: '/api/admin/auth/login',
      ip: '127.0.0.1',
      socket: {},
      header: jest.fn((name: string) => (name === 'x-request-id' ? 'incoming-request-1' : undefined)),
      [AUTH_CONTEXT_REQUEST_KEY]: {
        user: { id: 'user-1', memberships: [{ tenantId: 'tenant-1' }] },
      },
    } as unknown as Request;
    const response = responseMock();
    response.statusCode = 429;

    middleware.use(request, response, jest.fn());
    response.emit('finish');

    expect(request.requestId).toBe('incoming-request-1');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'incoming-request-1');
    expect(logger.event).toHaveBeenCalledWith(
      'warn',
      'http.request.completed',
      'POST /api/admin/auth/login 429',
      expect.objectContaining({
        requestId: 'incoming-request-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
      }),
    );
  });
});
