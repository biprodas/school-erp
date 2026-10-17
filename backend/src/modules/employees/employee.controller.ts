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
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { FilterEmployeeDto } from './dto/filter-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeService } from './employee.service';

@ApiTags('Tenant / Employees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_READ)
  async findAll(@Query() filter: FilterEmployeeDto) {
    const employees = await this.employeeService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of employees',
      data: employees,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_CREATE)
  async create(@Body() dto: CreateEmployeeDto) {
    const employee = await this.employeeService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Employee created. ID: ${employee.id}`,
      data: employee,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const employee = await this.employeeService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Employee found. ID: ${employee.id}`,
      data: employee,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const employee = await this.employeeService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Employee updated. ID: ${employee.id}`,
      data: employee,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.employeeService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Employee deleted. ID: ${id}`,
    };
  }
}
