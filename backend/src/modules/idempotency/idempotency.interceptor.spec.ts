import {
  BadRequestException,
  ConflictException,
  Controller,
  INestApplication,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { APP_INTERCEPTOR, type ModuleRef } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { lastValueFrom, of, throwError } from 'rxjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ResponseEnvelopeInterceptor } from '~/common/interceptors/response-envelope.interceptor';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyStore, type ClaimResult } from './idempotency.store';
import { Idempotent } from './idempotent.decorator';

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

/**
 * Through a real Nest app: the status set in the interceptor must survive
 * Nest's reply (which doesn't reapply the route default), and the global
 * envelope must wrap the replayed body exactly like the original.
 */
describe('IdempotencyInterceptor over HTTP', () => {
  @Controller('payments')
  class PaymentController {
    @Post()
    @Idempotent()
    create() {
      return { id: 'p1' };
    }
  }

  let app: INestApplication<App>;
  const store = {
    claim: jest.fn(),
    complete: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        IdempotencyInterceptor,
        { provide: IdempotencyStore, useValue: store },
        { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('stores the status of the first response', async () => {
    store.claim.mockResolvedValue({ state: 'claimed', id: 'k1' });

    const res = await request(app.getHttpServer())
      .post('/payments')
      .set('Idempotency-Key', 'pay-0001-abcd')
      .send({ amount: 500 });

    expect(res.status).toBe(201);
    expect(store.complete).toHaveBeenCalledWith('k1', 201, { id: 'p1' });
  });

  it('replays the stored status and the same envelope', async () => {
    store.claim.mockResolvedValue({
      state: 'completed',
      statusCode: 202,
      response: { id: 'p1' },
    });

    const res = await request(app.getHttpServer())
      .post('/payments')
      .set('Idempotency-Key', 'pay-0001-abcd')
      .send({ amount: 500 });

    expect(res.status).toBe(202);
    expect(res.headers['idempotent-replayed']).toBe('true');
    expect(res.body).toEqual({
      success: true,
      statusCode: 202,
      message: 'OK',
      data: { id: 'p1' },
    });
  });
});
