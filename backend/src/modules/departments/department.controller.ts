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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { FilterDepartmentDto } from './dto/filter-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentService } from './department.service';

@ApiTags('Tenant / Departments')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_READ)
  async findAll(@Query() filter: FilterDepartmentDto) {
    const departments = await this.departmentService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of departments',
      data: departments,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_CREATE)
  async create(@Body() dto: CreateDepartmentDto) {
    const department = await this.departmentService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Department created. ID: ${department.id}`,
      data: department,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const department = await this.departmentService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Department found. ID: ${department.id}`,
      data: department,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    const department = await this.departmentService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Department updated. ID: ${department.id}`,
      data: department,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.departmentService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Department deleted. ID: ${id}`,
    };
  }
}
