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
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateEnrollmentDto } from '../dto/create-enrollment.dto';
import { FilterEnrollmentDto } from '../dto/filter-enrollment.dto';
import { UpdateEnrollmentDto } from '../dto/update-enrollment.dto';
import { EnrollmentService } from '../services/enrollment.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Enrollments')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('enrollments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_READ)
  @ResponseMessage('List of enrollments')
  findAll(@Query() filter: FilterEnrollmentDto) {
    return this.enrollmentService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_CREATE)
  @ResponseMessage('Enrollment created')
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_READ)
  @ResponseMessage('Enrollment found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.enrollmentService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_UPDATE)
  @ResponseMessage('Enrollment updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_DELETE)
  @ResponseMessage('Enrollment deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.enrollmentService.remove(id);
  }
}
