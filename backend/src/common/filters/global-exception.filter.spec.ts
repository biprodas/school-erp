import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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

  describe('error code', () => {
    const codeOf = (exception: unknown) =>
      (run(exception).json.mock.calls[0] as [{ code: string }])[0].code;

    it('uses an explicit code from the exception body', () => {
      expect(
        codeOf(new ConflictException({ message: 'Taken', code: 'SLUG_TAKEN' })),
      ).toBe('SLUG_TAKEN');
    });

    it('derives the code from the status', () => {
      expect(codeOf(new NotFoundException('Student not found'))).toBe(
        'NOT_FOUND',
      );
    });

    it('marks ValidationPipe failures as VALIDATION_FAILED', () => {
      expect(codeOf(new BadRequestException(['name must be a string']))).toBe(
        'VALIDATION_FAILED',
      );
    });

    it('names Postgres conflicts', () => {
      const error = new QueryFailedError('INSERT ...', [], {
        code: '23505',
      } as unknown as Error);
      expect(codeOf(error)).toBe('UNIQUE_VIOLATION');
    });

    it('hides details of unexpected errors', () => {
      expect(codeOf(new Error('boom'))).toBe('INTERNAL_ERROR');
    });
  });
});
