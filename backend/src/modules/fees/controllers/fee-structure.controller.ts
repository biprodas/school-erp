import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import {
  CreateFeeStructureDto,
  FilterFeeStructureDto,
  UpdateFeeStructureDto,
} from '../dto/fee-setup.dto';
import { FeeSetupService } from '../services/fee-setup.service';

/** Fee structures: what a class (group, shift) pays in a session. */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('fee-structures')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class FeeStructureController {
  constructor(private readonly setup: FeeSetupService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Fee structures')
  findAll(@Query() filter: FilterFeeStructureDto) {
    return this.setup.listStructures(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Fee structure created')
  create(@Body() dto: CreateFeeStructureDto) {
    return this.setup.createStructure(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Fee structure')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.setup.findStructure(id);
  }

  /** `items`, when given, replace the structure's items. */
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Fee structure updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeeStructureDto,
  ) {
    return this.setup.updateStructure(id, dto);
  }

  /** Invoices already made keep their lines. */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Fee structure deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.setup.removeStructure(id);
  }
}
