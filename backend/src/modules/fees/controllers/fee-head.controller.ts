import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequireModule } from '~/modules/plans/decorators/require-module.decorator';
import { PLAN_MODULES } from '~/modules/plans/plans.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { CreateFeeHeadDto, UpdateFeeHeadDto } from '../dto/fee-setup.dto';
import { FeeSetupService } from '../services/fee-setup.service';

/** Fee heads (tuition, admission, exam, …). */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('fee-heads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class FeeHeadController {
  constructor(private readonly setup: FeeSetupService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Fee heads')
  findAll() {
    return this.setup.listHeads();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Fee head created')
  create(@Body() dto: CreateFeeHeadDto) {
    return this.setup.createHead(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Fee head updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeeHeadDto,
  ) {
    return this.setup.updateHead(id, dto);
  }

  /** Refused (409) once used; deactivate it instead. */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Fee head deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.setup.removeHead(id);
  }
}
