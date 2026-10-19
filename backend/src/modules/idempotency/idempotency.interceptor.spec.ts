import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import type { ClaimResult } from './idempotency.store';

describe('IdempotencyInterceptor', () => {
  let store: { claim: jest.Mock; complete: jest.Mock; release: jest.Mock };
  let interceptor: IdempotencyInterceptor;
  let res: { statusCode: number; status: jest.Mock; setHeader: jest.Mock };

  const context = (headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/payments',
          body: { amount: 500 },
          headers,
          user: { userId: 'user-1' },
        }),
        getResponse: () => res,
      }),
    }) as never;

  const run = (headers: Record<string, string>, handler = of({ id: 'p1' })) =>
    lastValueFrom(
      interceptor.intercept(context(headers), { handle: () => handler }),
    );

  const claimed = (result: ClaimResult) =>
    store.claim.mockResolvedValue(result);

  beforeEach(() => {
    store = {
      claim: jest.fn(),
      complete: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    res = { statusCode: 201, status: jest.fn(), setHeader: jest.fn() };
    interceptor = new IdempotencyInterceptor({
      resolve: () => Promise.resolve(store),
    } as unknown as ModuleRef);
  });

  it('passes requests without the header straight through', async () => {
    await expect(run({})).resolves.toEqual({ id: 'p1' });
    expect(store.claim).not.toHaveBeenCalled();
  });

  it('rejects a malformed key', async () => {
    await expect(run({ 'idempotency-key': 'short' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('runs the first request and stores its response', async () => {
    claimed({ state: 'claimed', id: 'k1' });

    await expect(run({ 'idempotency-key': 'pay-0001-abcd' })).resolves.toEqual({
      id: 'p1',
    });
    expect(store.claim).toHaveBeenCalledWith(
      'pay-0001-abcd',
      expect.stringMatching(/^[0-9a-f]{64}$/),
      'user-1',
    );
    expect(store.complete).toHaveBeenCalledWith('k1', 201, { id: 'p1' });
  });

  it('replays a completed request without running the handler', async () => {
    claimed({ state: 'completed', statusCode: 201, response: { id: 'p1' } });
    const handler = jest.fn();

    await expect(
      lastValueFrom(
        interceptor.intercept(context({ 'idempotency-key': 'pay-0001-abcd' }), {
          handle: handler,
        }),
      ),
    ).resolves.toEqual({ id: 'p1' });
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
  });

  it('rejects the same key with a different body', async () => {
    claimed({ state: 'mismatch' });
    await expect(
      run({ 'idempotency-key': 'pay-0001-abcd' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects a retry while the first request still runs', async () => {
    claimed({ state: 'in_progress' });
    await expect(
      run({ 'idempotency-key': 'pay-0001-abcd' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('frees the key when the handler fails', async () => {
    claimed({ state: 'claimed', id: 'k1' });
    await expect(
      run(
        { 'idempotency-key': 'pay-0001-abcd' },
        throwError(() => new Error('boom')),
      ),
    ).rejects.toThrow('boom');
    expect(store.release).toHaveBeenCalledWith('k1');
    expect(store.complete).not.toHaveBeenCalled();
  });
});
