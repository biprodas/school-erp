import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import {
  ChangeAssignmentDto,
  EndAssignmentDto,
} from '../dto/change-assignment.dto';
import { CreateSubjectTeacherDto } from '../dto/create-subject-teacher.dto';
import { FilterSubjectTeacherDto } from '../dto/filter-subject-teacher.dto';
import { SubjectTeacherService } from '../services/subject-teacher.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

/**
 * Subject teachers per section and class subject, effective-dated.
 * Lists follow the scope rules (a teacher sees their own sections only);
 * `?current=true` or `?on=YYYY-MM-DD` narrow them in time.
 */
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
  constructor(
    private readonly subjectTeacherService: SubjectTeacherService,
    private readonly scope: AccessScope,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_READ)
  @ResponseMessage('List of subject teachers')
  async findAll(@Query() filter: FilterSubjectTeacherDto) {
    const allowed = await this.scope.sections(
      PERMISSIONS.SUBJECT_TEACHERS_READ,
    );
    return this.subjectTeacherService.findFiltered(filter, allowed);
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
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.subjectTeacherService.findById(id);
    if (
      !(await this.scope.canAccessSection(
        PERMISSIONS.SUBJECT_TEACHERS_READ,
        row.sectionId,
      ))
    ) {
      throw new NotFoundException('Assignment not found');
    }
    return row;
  }

  /** Hand over to another teacher, or correct the current row. */
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_UPDATE)
  @ResponseMessage('Subject teacher changed')
  change(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeAssignmentDto,
  ) {
    return this.subjectTeacherService.change(id, dto);
  }

  /** End-date the assignment (kept as history). */
  @Post(':id/end')
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_UPDATE)
  @ResponseMessage('Subject teacher ended')
  end(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndAssignmentDto) {
    return this.subjectTeacherService.end(id, dto);
  }

  /** Only a current row created in error; ended rows are history (409). */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_TEACHERS_DELETE)
  @ResponseMessage('Subject teacher removed')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.subjectTeacherService.remove(id);
  }
}
