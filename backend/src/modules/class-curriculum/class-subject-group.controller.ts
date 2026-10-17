import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateClassSubjectGroupDto } from './dto/create-class-subject-group.dto';
import { FilterClassSubjectGroupDto } from './dto/filter-class-subject-group.dto';
import { ClassSubjectGroupService } from './class-subject-group.service';

@ApiTags('Tenant / Class Subject Groups')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('class-subject-groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassSubjectGroupController {
  constructor(
    private readonly classSubjectGroupService: ClassSubjectGroupService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECT_GROUPS_READ)
  async findAll(@Query() filter: FilterClassSubjectGroupDto) {
    const items = await this.classSubjectGroupService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of class subject groups',
      data: items,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECT_GROUPS_CREATE)
  async create(@Body() dto: CreateClassSubjectGroupDto) {
    const item = await this.classSubjectGroupService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Class subject group created. ID: ${item.id}`,
      data: item,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECT_GROUPS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.classSubjectGroupService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Class subject group found. ID: ${item.id}`,
      data: item,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECT_GROUPS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.classSubjectGroupService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Class subject group deleted. ID: ${id}`,
    };
  }
}
