import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { Idempotent } from '~/modules/idempotency/idempotent.decorator';
import {
  BulkApproveDto,
  ReopenMarkSheetDto,
  SaveMarksDto,
} from '../dto/mark-sheet.dto';
import { MarkSheetService } from '../services/mark-sheet.service';

/**
 * Mark entry and its workflow (PRD 6.9). Subject teachers enter and
 * submit the subjects they teach; verify, approve and reopen follow the
 * caller's sections.
 */
@ApiTags('Tenant / Exams')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('mark-sheets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MarkSheetController {
  constructor(
    private readonly sheets: MarkSheetService,
    private readonly scope: AccessScope,
  ) {}

  /** The grid: students, cells and the grade computed for each. */
  @Get(':id/marks')
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Mark sheet')
  async grid(@Param('id', ParseUUIDPipe) id: string) {
    await this.assertSection(PERMISSIONS.RESULTS_READ, id);
    return this.sheets.grid(id);
  }

  /** Saves cells of a draft sheet; returns the grid. */
  @Put(':id/marks')
  @Idempotent()
  @RequirePermissions(PERMISSIONS.RESULTS_ENTER)
  @ResponseMessage('Marks saved')
  async save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveMarksDto,
  ) {
    await this.assertSubject(id);
    return this.sheets.saveMarks(id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.RESULTS_ENTER)
  @ResponseMessage('Mark sheet submitted')
  async submit(@Param('id', ParseUUIDPipe) id: string) {
    await this.assertSubject(id);
    return this.sheets.submit(id);
  }

  @Post(':id/verify')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.RESULTS_VERIFY)
  @ResponseMessage('Mark sheet verified')
  async verify(@Param('id', ParseUUIDPipe) id: string) {
    await this.assertSection(PERMISSIONS.RESULTS_VERIFY, id);
    return this.sheets.verify(id);
  }

  /** Approves several sheets at once (a whole class). */
  @Post('approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.RESULTS_APPROVE)
  @ResponseMessage('Mark sheets approved')
  async approveMany(@Body() dto: BulkApproveDto) {
    for (const id of dto.markSheetIds) {
      await this.assertSection(PERMISSIONS.RESULTS_APPROVE, id);
    }
    return this.sheets.approveMany(dto.markSheetIds);
  }

  /** Approved sheets are read-only; tabulation follows once a result is complete. */
  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.RESULTS_APPROVE)
  @ResponseMessage('Mark sheet approved')
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    await this.assertSection(PERMISSIONS.RESULTS_APPROVE, id);
    return this.sheets.approve(id);
  }

  /** Back to draft with a reason (audited). */
  @Post(':id/reopen')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.RESULTS_REOPEN)
  @ResponseMessage('Mark sheet reopened')
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenMarkSheetDto,
  ) {
    await this.assertSection(PERMISSIONS.RESULTS_REOPEN, id);
    return this.sheets.reopen(id, dto.reason);
  }

  private async assertSection(key: PermissionKey, id: string) {
    const sheet = await this.sheets.findById(id);
    if (!(await this.scope.canAccessSection(key, sheet.sectionId))) {
      throw new NotFoundException(`Mark sheet "${id}" not found`);
    }
  }

  /** Entering marks: the subject must be one the caller teaches there. */
  private async assertSubject(id: string) {
    const sheet = await this.sheets.findById(id);
    const ref = {
      sectionId: sheet.sectionId,
      classSubjectId: sheet.examSubject!.classSubjectId,
    };
    if (await this.scope.canAccessSubject(PERMISSIONS.RESULTS_ENTER, ref))
      return;
    if (
      await this.scope.canAccessSection(
        PERMISSIONS.RESULTS_READ,
        sheet.sectionId,
      )
    ) {
      throw new ForbiddenException({
        message: 'Only the subject’s teacher enters these marks',
        code: 'NOT_SUBJECT_TEACHER',
      });
    }
    throw new NotFoundException(`Mark sheet "${id}" not found`);
  }
}
