import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { InviteUserDto } from '../dto/invite-user.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InviteService } from '../services/invite.service';

/**
 * `POST /users/invite`. Lives in AuthModule (it mints activation tokens);
 * the rest of `/users` is in UserModule.
 */
@ApiTags('Tenant / Users')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  /**
   * Adds someone to this school. Email → activation link; phone only → a
   * temporary password returned once, for a printed slip; existing account →
   * linked as-is.
   */
  @Post('invite')
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  @ResponseMessage('User invited')
  invite(@Body() dto: InviteUserDto) {
    return this.inviteService.invite(dto);
  }
}
