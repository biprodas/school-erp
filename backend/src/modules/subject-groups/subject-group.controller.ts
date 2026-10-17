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
import { CreateSubjectGroupDto } from './dto/create-subject-group.dto';
import { FilterSubjectGroupDto } from './dto/filter-subject-group.dto';
import { UpdateSubjectGroupDto } from './dto/update-subject-group.dto';
import { SubjectGroupService } from './subject-group.service';

@ApiTags('Tenant / Subject Groups')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('subject-groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubjectGroupController {
  constructor(private readonly subjectGroupService: SubjectGroupService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_READ)
  async findAll(@Query() filter: FilterSubjectGroupDto) {
    const groups = await this.subjectGroupService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of subject groups',
      data: groups,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_CREATE)
  async create(@Body() dto: CreateSubjectGroupDto) {
    const group = await this.subjectGroupService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Subject group created. ID: ${group.id}`,
      data: group,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const group = await this.subjectGroupService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Subject group found. ID: ${group.id}`,
      data: group,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectGroupDto,
  ) {
    const group = await this.subjectGroupService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Subject group updated. ID: ${group.id}`,
      data: group,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.subjectGroupService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Subject group deleted. ID: ${id}`,
    };
  }
}
