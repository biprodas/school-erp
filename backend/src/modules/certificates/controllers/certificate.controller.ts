import {
  Body,
  Controller,
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
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { StudentScope } from '~/modules/students/services/student-scope.service';
import {
  FilterCertificateDto,
  IssueCertificateDto,
  RevokeCertificateDto,
} from '../dto/certificate.dto';
import { CertificateService } from '../services/certificate.service';
import { IdCardService } from '../services/id-card.service';

@ApiTags('Tenant / Certificates')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CertificateController {
  constructor(
    private readonly certificates: CertificateService,
    private readonly idCards: IdCardService,
    private readonly studentScope: StudentScope,
    private readonly scope: AccessScope,
  ) {}

  @Get('certificates')
  @RequirePermissions(PERMISSIONS.CERTIFICATES_READ)
  @ResponseMessage('Certificates')
  findAll(@Query() filter: FilterCertificateDto) {
    return this.certificates.findFiltered(filter);
  }

  /** TC, testimonial, character or study certificate, with a serial. */
  @Post('students/:studentId/certificates')
  @RequirePermissions(PERMISSIONS.CERTIFICATES_ISSUE)
  @ResponseMessage('Certificate issued')
  async issue(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: IssueCertificateDto,
  ) {
    await this.studentScope.assert(PERMISSIONS.CERTIFICATES_ISSUE, studentId);
    return this.certificates.issue(studentId, dto);
  }

  @Get('certificates/:id')
  @RequirePermissions(PERMISSIONS.CERTIFICATES_READ)
  @ResponseMessage('Certificate found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.certificates.findById(id);
  }

  /** Revoked certificates verify as revoked from then on. */
  @Post('certificates/:id/revoke')
  @RequirePermissions(PERMISSIONS.CERTIFICATES_REVOKE)
  @ResponseMessage('Certificate revoked')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeCertificateDto,
  ) {
    return this.certificates.revoke(id, dto);
  }

  /** The PDF with its QR code, as a job; poll `GET /jobs/:id`. */
  @Post('certificates/:id/pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.CERTIFICATES_READ)
  @ResponseMessage('Certificate PDF started')
  pdf(@Param('id', ParseUUIDPipe) id: string) {
    return this.certificates.startPdf(id);
  }

  /** ID cards for a section's active students, as one PDF (job). */
  @Post('sections/:sectionId/id-cards')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.ID_CARDS_PRINT)
  @ResponseMessage('ID cards started')
  async printIdCards(@Param('sectionId', ParseUUIDPipe) sectionId: string) {
    if (
      !(await this.scope.canAccessSection(
        PERMISSIONS.ID_CARDS_PRINT,
        sectionId,
      ))
    ) {
      throw new NotFoundException('Section not found');
    }
    return this.idCards.start(sectionId);
  }
}
