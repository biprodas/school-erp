import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { RolloverDto } from './dto/rollover.dto';
import { RolloverService } from './rollover.service';

@ApiTags('Tenant / Academic Years')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('academic-years')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolloverController {
  constructor(private readonly rollover: RolloverService) {}

  /**
   * Copies another session's structure into `:targetId` as a job (poll
   * `GET /jobs/:id`). Refuses (409 `ROLLOVER_TARGET_NOT_EMPTY`) when the
   * target already has rows of an included kind, unless `mode: "merge"`.
   */
  @Post(':targetId/rollover')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_ROLLOVER)
  @ResponseMessage('Rollover started')
  start(
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Body() dto: RolloverDto,
  ) {
    return this.rollover.start(targetId, dto);
  }
}
