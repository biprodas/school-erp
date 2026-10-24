import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import {
  FileUpload,
  requireFile,
} from '~/modules/files/file-upload.interceptor';
import { MIME } from '~/modules/files/file-type';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  CommitImportDto,
  FilterImportDto,
  StartImportDto,
  TemplateQueryDto,
} from '../dto/import.dto';
import { ImportType } from '../enums/import.enum';
import { ImportService } from '../services/import.service';

/**
 * Excel imports (PRD 6.2). Each type needs its own key (`students:import`,
 * `employees:import`, `results:enter`), checked in the service.
 */
@ApiTags('Tenant / Imports')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('imports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(
  PERMISSIONS.STUDENTS_IMPORT,
  PERMISSIONS.EMPLOYEES_IMPORT,
  PERMISSIONS.RESULTS_ENTER,
)
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  /** The workbook to fill in: headers, an example row, dropdowns. */
  @Get('templates/:type')
  @Header('Content-Type', MIME.xlsx)
  async template(
    @Param('type', new ParseEnumPipe(ImportType)) type: ImportType,
    @Query() query: TemplateQueryDto,
  ) {
    return new StreamableFile(
      await this.imports.template(type, query.markSheetId ?? null),
      { disposition: `attachment; filename="${type}-import.xlsx"` },
    );
  }

  @Get()
  @ResponseMessage('Imports')
  findAll(@Query() filter: FilterImportDto) {
    return this.imports.findFiltered(filter);
  }

  /** Multipart `file` (.xlsx or .csv) plus `type`, `mode`, `academicYearId`. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileUpload('import'))
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Import uploaded; validating')
  start(
    @Body() dto: StartImportDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.imports.start(dto, requireFile(file));
  }

  /** Status, totals and every row with its errors (the preview). */
  @Get(':id')
  @ResponseMessage('Import')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.imports.findById(id);
  }

  @Post(':id/commit')
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Import commit started')
  commit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommitImportDto) {
    return this.imports.startCommit(id, dto);
  }
}
