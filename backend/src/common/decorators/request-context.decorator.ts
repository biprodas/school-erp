import { RequestContextDto } from '../dto/request-context.dto';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { createRequestContext } from '~/utils/request-context';

export const RequestContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContextDto => {
    const request = ctx.switchToHttp().getRequest<Request>();

    return createRequestContext(request);
  },
);
