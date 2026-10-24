import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { RemarksDto } from '../dto/result.dto';
import { ResultService } from '../services/result.service';

/** One student's result. */
@ApiTags('Tenant / Results')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('results')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResultController {
  constructor(
    private readonly results: ResultService,
    private readonly scope: AccessScope,
  ) {}

  @Get(':id')
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Result')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.results.row(
      id,
      await this.scope.sections(PERMISSIONS.RESULTS_READ),
    );
  }

  /** The class teacher's remarks (their own sections). */
  @Put(':id/remarks')
  @RequirePermissions(PERMISSIONS.RESULTS_REMARKS)
  @ResponseMessage('Remarks saved')
  async remarks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemarksDto,
  ) {
    return this.results.setRemarks(
      id,
      dto.remarks,
      await this.scope.homeSections(PERMISSIONS.RESULTS_REMARKS),
    );
  }

  /** A signed link to the student's last report card. */
  @Get(':id/report-card')
  @RequirePermissions(PERMISSIONS.RESULTS_READ)
  @ResponseMessage('Download link')
  async reportCard(@Param('id', ParseUUIDPipe) id: string) {
    return this.results.reportCardUrl(
      id,
      await this.scope.sections(PERMISSIONS.RESULTS_READ),
    );
  }
}
