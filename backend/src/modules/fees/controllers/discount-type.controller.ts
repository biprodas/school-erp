import {
  Body,
  Controller,
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
  CreateDiscountTypeDto,
  UpdateDiscountTypeDto,
} from '../dto/fee-setup.dto';
import { FeeSetupService } from '../services/fee-setup.service';

/** Discount types (sibling, merit, staff child, freedom fighter, custom). */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('discount-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class DiscountTypeController {
  constructor(private readonly setup: FeeSetupService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Discount types')
  findAll() {
    return this.setup.listDiscountTypes();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Discount type created')
  create(@Body() dto: CreateDiscountTypeDto) {
    return this.setup.createDiscountType(dto);
  }

  /** Deactivate instead of deleting: invoices name it. */
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FEES_SETUP)
  @ResponseMessage('Discount type updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountTypeDto,
  ) {
    return this.setup.updateDiscountType(id, dto);
  }
}
