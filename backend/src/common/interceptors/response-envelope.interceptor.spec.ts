import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import {
  RawResponse,
  ResponseMessage,
} from '../decorators/response.decorators';
import { Paginated } from '../dto/paginated.dto';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

class TestController {
  @ResponseMessage('Thing created')
  create() {}

  plain() {}
}

@RawResponse()
class RawController {
  health() {}
}

function contextFor(
  controller: new () => object,
  handler: string,
  statusCode = 200,
): ExecutionContext {
  return {
    getType: () => 'http',
    getClass: () => controller,
    getHandler: () =>
      (controller.prototype as Record<string, () => void>)[handler],
    switchToHttp: () => ({
      getResponse: () => ({ statusCode }),
    }),
  } as unknown as ExecutionContext;
}

const returning = (value: unknown): CallHandler => ({
  handle: () => of(value),
});

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor(new Reflector());
  const run = (ctx: ExecutionContext, value: unknown) =>
    lastValueFrom(interceptor.intercept(ctx, returning(value)));

  it('wraps the result with the status code and @ResponseMessage', async () => {
    const result = await run(contextFor(TestController, 'create', 201), {
      id: '1',
    });

    expect(result).toEqual({
      success: true,
      statusCode: 201,
      message: 'Thing created',
      data: { id: '1' },
    });
  });

  it('defaults the message to OK and data to null', async () => {
    const result = await run(contextFor(TestController, 'plain'), undefined);

    expect(result).toEqual({
      success: true,
      statusCode: 200,
      message: 'OK',
      data: null,
    });
  });

  it('puts paginated items in data and page info in meta', async () => {
    const page = new Paginated([{ id: '1' }, { id: '2' }], 45, {
      page: 2,
      limit: 20,
    });

    const result = await run(contextFor(TestController, 'plain'), page);

    expect(result).toEqual({
      success: true,
      statusCode: 200,
      message: 'OK',
      data: [{ id: '1' }, { id: '2' }],
      meta: { page: 2, limit: 20, total: 45, totalPages: 3 },
    });
  });

  it('leaves @RawResponse controllers and file downloads untouched', async () => {
    const health = { status: 'ok' };
    expect(await run(contextFor(RawController, 'health'), health)).toBe(health);

    const file = new StreamableFile(Buffer.from('x'));
    expect(await run(contextFor(TestController, 'plain'), file)).toBe(file);
  });
});
