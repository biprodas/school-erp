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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateSubjectTeacherDto } from './dto/create-subject-teacher.dto';
import { FilterSubjectTeacherDto } from './dto/filter-subject-teacher.dto';
import { SubjectTeacherService } from './subject-teacher.service';

@ApiTags('Tenant / Subject Teachers')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('subject-teachers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubjectTeacherController {
  constructor(private readonly subjectTeacherService: SubjectTeacherService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_READ)
  async findAll(@Query() filter: FilterSubjectTeacherDto) {
    const items = await this.subjectTeacherService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of subject teachers',
      data: items,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_CREATE)
  async create(@Body() dto: CreateSubjectTeacherDto) {
    const item = await this.subjectTeacherService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Subject teacher assigned. ID: ${item.id}`,
      data: item,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.subjectTeacherService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Subject teacher found. ID: ${item.id}`,
      data: item,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.subjectTeacherService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Subject teacher removed. ID: ${id}`,
    };
  }
}
