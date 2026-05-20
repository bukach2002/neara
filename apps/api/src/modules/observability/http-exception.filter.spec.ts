import { BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  function host(exceptionRequest: Record<string, unknown>, response: Record<string, jest.Mock>) {
    return {
      switchToHttp: () => ({
        getRequest: () => exceptionRequest,
        getResponse: () => response,
      }),
    } as never;
  }

  function responseMock() {
    const response: { status: jest.Mock; json: jest.Mock } = {
      status: jest.fn(),
      json: jest.fn(),
    };
    response.status.mockReturnValue(response);
    return response;
  }

  it('captures 5xx errors with request context and preserves generic response body', () => {
    const observability = { captureException: jest.fn() };
    const filter = new HttpExceptionFilter(observability as never);
    const response = responseMock();
    const error = new Error('database failed');

    filter.catch(error, host({
      method: 'GET',
      originalUrl: '/api/public/tenants',
      requestId: 'req-1',
    }, response));

    expect(observability.captureException).toHaveBeenCalledWith(error, {
      method: 'GET',
      path: '/api/public/tenants',
      requestId: 'req-1',
      statusCode: 500,
    });
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ message: 'Internal server error' });
  });

  it('does not capture expected 4xx exceptions', () => {
    const observability = { captureException: jest.fn() };
    const filter = new HttpExceptionFilter(observability as never);
    const response = responseMock();

    filter.catch(new BadRequestException('Invalid input'), host({
      method: 'POST',
      originalUrl: '/api/public/bookings',
      requestId: 'req-2',
    }, response));

    expect(observability.captureException).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });
});
