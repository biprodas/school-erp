import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
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
import type { PermissionKey } from '~/modules/rbac/permissions.catalog';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { RequireModule } from '~/modules/plans/decorators/require-module.decorator';
import { PLAN_MODULES } from '~/modules/plans/plans.catalog';
import {
  CreateResultDefinitionDto,
  FilterResultDefinitionDto,
  MeritQueryDto,
  ReportCardsDto,
  ResultExportDto,
  ResultsQueryDto,
} from '../dto/result.dto';
import { ResultDefinitionService } from '../services/result-definition.service';
import { ResultDocumentService } from '../services/result-document.service';
import { ResultService } from '../services/result.service';

/** Tabulation, publishing and result sheets per definition (PRD 6.9). */
@ApiTags('Tenant / Results')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('result-definitions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResultDefinitionController {
  constructor(
    private readonly definitions: ResultDefinitionService,
    private readonly results: ResultService,
    private readonly documents: ResultDocumentService,
    private readonly scope: AccessScope,
  ) {}

  /** With each one's status (sheets approved, current, published). */
  @Get()
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Result definitions')
  findAll(@Query() filter: FilterResultDefinitionDto) {
    return this.definitions.findFiltered(filter);
  }

  /** A combined result, e.g. 30% half-yearly + 70% annual. */
  @Post()
  @RequirePermissions(PERMISSIONS.RESULTS_PUBLISH)
  @ResponseMessage('Result definition created')
  async create(@Body() dto: CreateResultDefinitionDto) {
    await this.assertSchoolWide(PERMISSIONS.RESULTS_PUBLISH);
    return this.definitions.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Result definition')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.definitions.findById(id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.RESULTS_PUBLISH)
  @ResponseMessage('Result definition deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.assertSchoolWide(PERMISSIONS.RESULTS_PUBLISH);
    await this.definitions.remove(id);
  }

  /** Runs tabulation now (it also runs by itself on the last approval). */
  @Post(':id/tabulate')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.RESULTS_APPROVE)
  @ResponseMessage('Tabulation started')
  async tabulate(@Param('id', ParseUUIDPipe) id: string) {
    await this.assertSchoolWide(PERMISSIONS.RESULTS_APPROVE);
    return this.definitions.startTabulation(id);
  }

  /** Only while results are current (`RESULTS_NOT_CURRENT`). */
  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.RESULTS_PUBLISH)
  @ResponseMessage('Results published')
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    await this.assertSchoolWide(PERMISSIONS.RESULTS_PUBLISH);
    return this.definitions.publish(id);
  }

  /** The tabulation sheet (class merit order). */
  @Get(':id/results')
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Results')
  async rows(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ResultsQueryDto,
  ) {
    return this.results.rows(id, q.sectionId, await this.allowed());
  }

  @Get(':id/merit-list')
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Merit list')
  async merit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: MeritQueryDto,
  ) {
    return this.results.merit(id, q.sectionId, await this.allowed(), q.limit);
  }

  @Get(':id/failed')
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Failed list')
  async failed(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ResultsQueryDto,
  ) {
    return this.results.failed(id, q.sectionId, await this.allowed());
  }

  @Get(':id/analysis')
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Subject-wise analysis')
  async analysis(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ResultsQueryDto,
  ) {
    return this.results.analysis(id, q.sectionId, await this.allowed());
  }

  /** A sheet as Excel or PDF (job); limited to the caller's sections. */
  @Post(':id/exports')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Export started')
  async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResultExportDto,
  ) {
    return this.documents.startExport(id, dto, await this.allowed());
  }

  /** Report cards for a section: one PDF each plus the whole section. */
  @Post(':id/report-cards')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.REPORT_CARDS_PRINT)
  @RequireModule(PLAN_MODULES.REPORT_CARDS)
  @ResponseMessage('Report cards started')
  async reportCards(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportCardsDto,
  ) {
    if (
      !(await this.scope.canAccessSection(
        PERMISSIONS.REPORT_CARDS_PRINT,
        dto.sectionId,
      ))
    ) {
      throw new NotFoundException('Section not found');
    }
    return this.documents.startReportCards(id, dto);
  }

  private allowed() {
    return this.scope.sections(PERMISSIONS.RESULTS_READ);
  }

  /** Class-wide actions need the key school-wide, not per section. */
  private async assertSchoolWide(key: PermissionKey) {
    if ((await this.scope.sections(key)) !== null) {
      throw new ForbiddenException({
        message: 'This needs the permission school-wide',
        code: 'SCHOOL_WIDE_ONLY',
      });
    }
  }
}
