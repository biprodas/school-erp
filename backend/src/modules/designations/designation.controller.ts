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
import { CreateDesignationDto } from './dto/create-designation.dto';
import { FilterDesignationDto } from './dto/filter-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { DesignationService } from './designation.service';

@ApiTags('Tenant / Designations')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('designations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DesignationController {
  constructor(private readonly designationService: DesignationService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_READ)
  async findAll(@Query() filter: FilterDesignationDto) {
    const designations = await this.designationService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of designations',
      data: designations,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_CREATE)
  async create(@Body() dto: CreateDesignationDto) {
    const designation = await this.designationService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Designation created. ID: ${designation.id}`,
      data: designation,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const designation = await this.designationService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Designation found. ID: ${designation.id}`,
      data: designation,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    const designation = await this.designationService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Designation updated. ID: ${designation.id}`,
      data: designation,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.designationService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Designation deleted. ID: ${id}`,
    };
  }
}
