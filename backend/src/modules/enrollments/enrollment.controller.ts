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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { FilterEnrollmentDto } from './dto/filter-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { EnrollmentService } from './enrollment.service';

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
  async findAll(@Query() filter: FilterEnrollmentDto) {
    const items = await this.enrollmentService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of enrollments',
      data: items,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_CREATE)
  async create(@Body() dto: CreateEnrollmentDto) {
    const item = await this.enrollmentService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Enrollment created. ID: ${item.id}`,
      data: item,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.enrollmentService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Enrollment found. ID: ${item.id}`,
      data: item,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    const item = await this.enrollmentService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Enrollment updated. ID: ${item.id}`,
      data: item,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.enrollmentService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Enrollment deleted. ID: ${id}`,
    };
  }
}
