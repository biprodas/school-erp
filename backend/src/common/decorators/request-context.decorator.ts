import { RequestContextDto } from '~/common/dto/request-context.dto'
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { createRequestContext } from '~/utils/request-context'

export const RequestContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContextDto => {
    const request = ctx.switchToHttp().getRequest()

    return createRequestContext(request)
  },
)