import { RequestContextDto } from '../dto/request-context.dto';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { createRequestContext } from '~/utils/request-context';

/**
 * The caller's identity and tenant (`RequestContextDto`) as a handler
 * parameter. Not to be confused with the `RequestContext` service in
 * `~/shared/request-context`, which carries the same facts outside handlers.
 */
export const ReqContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContextDto => {
    const request = ctx.switchToHttp().getRequest<Request>();

    return createRequestContext(request);
  },
);
