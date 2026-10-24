import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { DecisionDto } from '../dto/fee-setup.dto';
import { FilterAdjustmentDto, RequestAdjustmentDto } from '../dto/payment.dto';
import { AdjustmentService } from '../services/adjustment.service';

/** Refunds, waivers and corrections; they apply once approved. */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('fee-adjustments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class AdjustmentController {
  constructor(private readonly adjustments: AdjustmentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Adjustments')
  findAll(@Query() filter: FilterAdjustmentDto) {
    return this.adjustments.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FEES_ADJUST)
  @ResponseMessage('Adjustment requested')
  request(@Body() dto: RequestAdjustmentDto) {
    return this.adjustments.request(dto);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FEES_APPROVE_WAIVER)
  @ResponseMessage('Adjustment approved')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.adjustments.approve(id, dto);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FEES_APPROVE_WAIVER)
  @ResponseMessage('Adjustment rejected')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.adjustments.reject(id, dto);
  }
}
