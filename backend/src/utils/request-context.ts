import { Request } from 'express';
import { plainToClass } from 'class-transformer';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { Key } from '~/common/enums/keys.enum';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { UserDto } from '~/modules/users/dto/user.dto';

// Creates a RequestContext object from Request
export function createRequestContext(request: Request): RequestContextDto {
  const ctx = new RequestContextDto();
  ctx.requestId = request.header(Key.RequestIdTokenHeader) ?? '';
  const forwarded = request.header(Key.ForwardedForTokenHeader);
  ctx.ip = forwarded ?? request.ip ?? '';
  // ctx.clientIp = request.clientIp;

  ctx.protocol = request.protocol;
  ctx.host = request.get('host') ?? '';
  ctx.url = request.url;

  ctx.orgId = (request as RequestWithOrg).orgId ?? null;

  const authUser = request.user;
  if (authUser) {
    ctx.userId = authUser.userId;
    ctx.user = plainToClass(
      UserDto,
      { ...authUser, id: authUser.userId },
      { excludeExtraneousValues: true },
    );
  } else {
    ctx.userId = null;
    ctx.user = null;
  }

  return ctx;
}
