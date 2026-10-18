import { NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  const run = (exception: unknown) => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          originalUrl: '/api/x',
          method: 'POST',
          headers: {},
        }),
      }),
    };
    new GlobalExceptionFilter().catch(exception, host as never);
    return { status, json };
  };

  it('maps a unique violation from Postgres to 409', () => {
    const error = new QueryFailedError('INSERT ...', [], {
      code: '23505',
    } as unknown as Error);

    const { status, json } = run(error);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, statusCode: 409 }),
    );
  });

  it('keeps other database errors as 500', () => {
    const error = new QueryFailedError('SELECT ...', [], {
      code: '42P01',
    } as unknown as Error);

    expect(run(error).status).toHaveBeenCalledWith(500);
  });

  it('returns the error envelope and keeps statusCode authoritative', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          originalUrl: '/api/things/1',
          method: 'GET',
          headers: {},
        }),
      }),
    };

    new GlobalExceptionFilter().catch(
      new NotFoundException('Thing not found'),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        message: 'Thing not found',
        error: 'Not Found',
        path: '/api/things/1',
      }),
    );
  });
});
