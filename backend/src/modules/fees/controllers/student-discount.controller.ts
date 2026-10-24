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
import {
  DecisionDto,
  FilterStudentDiscountDto,
  RequestStudentDiscountDto,
} from '../dto/fee-setup.dto';
import { StudentDiscountService } from '../services/student-discount.service';

/** Discounts for students; they apply once approved. */
@ApiTags('Tenant / Fees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('student-discounts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.FEES)
export class StudentDiscountController {
  constructor(private readonly discounts: StudentDiscountService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FEES_READ)
  @ResponseMessage('Student discounts')
  findAll(@Query() filter: FilterStudentDiscountDto) {
    return this.discounts.list(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FEES_ADJUST)
  @ResponseMessage('Discount requested')
  request(@Body() dto: RequestStudentDiscountDto) {
    return this.discounts.request(dto);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FEES_APPROVE_WAIVER)
  @ResponseMessage('Discount approved')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.discounts.approve(id, dto);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FEES_APPROVE_WAIVER)
  @ResponseMessage('Discount rejected')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.discounts.reject(id, dto);
  }
}
