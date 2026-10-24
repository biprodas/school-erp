import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import {
  AddExamSubjectsDto,
  CreateExamDto,
  FilterExamDto,
  FilterExamSubjectDto,
  UpdateExamDto,
  UpdateExamSubjectDto,
} from '../dto/exam.dto';
import { FilterMarkSheetDto } from '../dto/mark-sheet.dto';
import { ExamService } from '../services/exam.service';
import { MarkSheetService } from '../services/mark-sheet.service';

/** Exam setup (PRD 6.9, workflow 7.4 step 1). */
@ApiTags('Tenant / Exams')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('exams')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExamController {
  constructor(
    private readonly exams: ExamService,
    private readonly sheets: MarkSheetService,
    private readonly scope: AccessScope,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EXAMS_READ)
  @ResponseMessage('Exams')
  findAll(@Query() filter: FilterExamDto) {
    return this.exams.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXAMS_CREATE)
  @ResponseMessage('Exam created')
  create(@Body() dto: CreateExamDto) {
    return this.exams.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EXAMS_READ)
  @ResponseMessage('Exam')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.exams.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EXAMS_UPDATE)
  @ResponseMessage('Exam updated')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExamDto) {
    return this.exams.update(id, dto);
  }

  /** Only while no marks are entered. */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EXAMS_DELETE)
  @ResponseMessage('Exam deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.exams.remove(id);
  }

  @Get(':id/subjects')
  @RequirePermissions(PERMISSIONS.EXAMS_READ)
  @ResponseMessage('Exam subjects')
  subjects(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filter: FilterExamSubjectDto,
  ) {
    return this.exams.subjects(id, filter.classId);
  }

  /** Every subject of `classIds` and/or chosen `classSubjectIds`. */
  @Post(':id/subjects')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.EXAMS_UPDATE)
  @ResponseMessage('Subjects attached')
  addSubjects(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddExamSubjectsDto,
  ) {
    return this.exams.addSubjects(id, dto);
  }

  /** Full and pass marks per component, until marks are entered. */
  @Patch(':id/subjects/:examSubjectId')
  @RequirePermissions(PERMISSIONS.EXAMS_UPDATE)
  @ResponseMessage('Exam subject updated')
  updateSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('examSubjectId', ParseUUIDPipe) examSubjectId: string,
    @Body() dto: UpdateExamSubjectDto,
  ) {
    return this.exams.updateSubject(id, examSubjectId, dto);
  }

  @Delete(':id/subjects/:examSubjectId')
  @RequirePermissions(PERMISSIONS.EXAMS_UPDATE)
  @ResponseMessage('Exam subject removed')
  async removeSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('examSubjectId', ParseUUIDPipe) examSubjectId: string,
  ) {
    await this.exams.removeSubject(id, examSubjectId);
  }

  /** Opens mark entry: creates the mark sheets (again for new sections). */
  @Post(':id/open')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.EXAMS_UPDATE)
  @ResponseMessage('Exam open for marks')
  open(@Param('id', ParseUUIDPipe) id: string) {
    return this.exams.open(id);
  }

  /** The exam's mark sheets in the caller's sections. */
  @Get(':id/mark-sheets')
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Mark sheets')
  async markSheets(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filter: FilterMarkSheetDto,
  ) {
    await this.exams.findById(id);
    return this.sheets.listForExam(
      id,
      filter,
      await this.scope.sections(PERMISSIONS.RESULTS_READ),
    );
  }
}
