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
import {
  CreateLateFineRuleDto,
  UpdateLateFineRuleDto,
} from '../dto/fee-setup.dto';
import { FeeSetupService } from '../services/fee-setup.service';

/** Late fines: fixed or per day after a grace period. */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('late-fine-rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class LateFineRuleController {
  constructor(private readonly setup: FeeSetupService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Late fine rules')
  findAll() {
    return this.setup.listFineRules();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Late fine rule created')
  create(@Body() dto: CreateLateFineRuleDto) {
    return this.setup.createFineRule(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Late fine rule updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLateFineRuleDto,
  ) {
    return this.setup.updateFineRule(id, dto);
  }

  /** Fines already added stay on their invoices. */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Late fine rule deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.setup.removeFineRule(id);
  }
}
