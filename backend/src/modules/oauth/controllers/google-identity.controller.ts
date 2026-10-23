import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ReqContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { IdentityProvider } from '~/modules/auth/entities/user-identity.entity';
import { IdentityService } from '~/modules/auth/services/identity.service';
import { AuditService } from '~/modules/audit/services/audit.service';
import { PlatformAuditService } from '~/modules/audit/services/platform-audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { StartGoogleLinkDto } from '../dto/google.dto';
import { GoogleAuthService } from '../google-auth.service';

/** Account settings on a school host: link or unlink Google. */
@ApiTags('Tenant / Auth')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('auth/identities/google')
@UseGuards(JwtAuthGuard)
export class GoogleIdentityController {
  constructor(
    private readonly google: GoogleAuthService,
    private readonly identities: IdentityService,
    private readonly audit: AuditService,
  ) {}

  /** The Google URL to send the browser to; it comes back with `?google=linked`. */
  @Post('link')
  @HttpCode(200)
  @ResponseMessage('Continue with Google.')
  link(@ReqContext() ctx: RequestContextDto, @Body() dto: StartGoogleLinkDto) {
    return this.google.startLink({
      userId: ctx.userId!,
      orgId: ctx.orgId,
      returnHost: dto.returnHost,
      next: dto.next,
    });
  }

  /** Refused (409 `PASSWORD_REQUIRED`) while the account has no password. */
  @Delete()
  @ResponseMessage('Google unlinked.')
  async unlink(@ReqContext() ctx: RequestContextDto) {
    await this.identities.unlink(ctx.userId!, IdentityProvider.GOOGLE);
    await this.audit.record({
      action: AUDIT_ACTIONS.IDENTITY_UNLINKED,
      entityType: 'user',
      entityId: ctx.userId!,
      after: { provider: IdentityProvider.GOOGLE },
    });
    return {};
  }
}

/** The same on the platform host. */
@ApiTags('Platform / Auth')
@ApiBearerAuth('platform-jwt')
@Controller('platform/auth/identities/google')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformGoogleIdentityController {
  constructor(
    private readonly google: GoogleAuthService,
    private readonly identities: IdentityService,
    private readonly audit: PlatformAuditService,
  ) {}

  @Post('link')
  @HttpCode(200)
  @ResponseMessage('Continue with Google.')
  link(@ReqContext() ctx: RequestContextDto, @Body() dto: StartGoogleLinkDto) {
    return this.google.startLink({
      userId: ctx.userId!,
      orgId: null,
      returnHost: dto.returnHost,
      next: dto.next,
    });
  }

  @Delete()
  @ResponseMessage('Google unlinked.')
  async unlink(@ReqContext() ctx: RequestContextDto) {
    await this.identities.unlink(ctx.userId!, IdentityProvider.GOOGLE);
    await this.audit.record({
      action: AUDIT_ACTIONS.IDENTITY_UNLINKED,
      entityType: 'user',
      entityId: ctx.userId!,
      after: { provider: IdentityProvider.GOOGLE },
    });
    return {};
  }
}
