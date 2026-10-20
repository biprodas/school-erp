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
import { CreateSubjectTeacherDto } from '../dto/create-subject-teacher.dto';
import { FilterSubjectTeacherDto } from '../dto/filter-subject-teacher.dto';
import { UpdateSubjectTeacherDto } from '../dto/update-subject-teacher.dto';
import { SubjectTeacherService } from '../services/subject-teacher.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('List of subject teachers')
  findAll(@Query() filter: FilterSubjectTeacherDto) {
    return this.subjectTeacherService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_CREATE)
  @ResponseMessage('Subject teacher assigned')
  create(@Body() dto: CreateSubjectTeacherDto) {
    return this.subjectTeacherService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_READ)
  @ResponseMessage('Subject teacher found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectTeacherService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_UPDATE)
  @ResponseMessage('Subject teacher updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectTeacherDto,
  ) {
    return this.subjectTeacherService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_DELETE)
  @ResponseMessage('Subject teacher removed')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.subjectTeacherService.remove(id);
  }
}
