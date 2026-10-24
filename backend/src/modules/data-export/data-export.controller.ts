import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '~/common/auth/auth-user';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { DataExportService } from './data-export.service';

/** The school's full data export (PRD 6.24). */
@ApiTags('Tenant / Settings')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('settings/export')
@UseGuards(JwtAuthGuard)
export class DataExportController {
  constructor(private readonly exporter: DataExportService) {}

  /**
   * Every school table as CSV in a zip (a job): poll `GET /jobs/:id` for
   * the link; the requester is also emailed. Owner and school admins only.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Data export started')
  start(@CurrentUser() user: AuthUser) {
    return this.exporter.start(user.isAdmin);
  }
}
