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
import { CreateSubjectDto } from './dto/create-subject.dto';
import { FilterSubjectDto } from './dto/filter-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectService } from './subject.service';

@ApiTags('Tenant / Subjects')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('subjects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SUBJECTS_READ)
  async findAll(@Query() filter: FilterSubjectDto) {
    const subjects = await this.subjectService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of subjects',
      data: subjects,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUBJECTS_CREATE)
  async create(@Body() dto: CreateSubjectDto) {
    const subject = await this.subjectService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Subject created. ID: ${subject.id}`,
      data: subject,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SUBJECTS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const subject = await this.subjectService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Subject found. ID: ${subject.id}`,
      data: subject,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SUBJECTS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    const subject = await this.subjectService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Subject updated. ID: ${subject.id}`,
      data: subject,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SUBJECTS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.subjectService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Subject deleted. ID: ${id}`,
    };
  }
}
