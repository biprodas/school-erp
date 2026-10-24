import { Throttle } from '@nestjs/throttler';
import { UPLOAD_THROTTLE } from '~/common/throttling/throttle.constants';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { FileUpload } from '~/modules/files/file-upload.interceptor';
import type { IncomingFile } from '~/modules/files/file.service';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { UpdateLocaleSettingsDto } from '../dto/update-locale-settings.dto';
import { UpdateNotificationSettingsDto } from '../dto/update-notification-settings.dto';
import { UpdateNumberingSettingsDto } from '../dto/update-numbering-settings.dto';
import { UpdateOrganizationSettingsDto } from '../dto/update-organization-settings.dto';
import { UpdatePortalSettingsDto } from '../dto/update-portal-settings.dto';
import { UpdateProfileSettingsDto } from '../dto/update-profile-settings.dto';
import {
  UpdateAttendanceSettingsDto,
  UpdateFeesSettingsDto,
  UpdateResultsSettingsDto,
  UpdateSecuritySettingsDto,
} from '../dto/update-workflow-settings.dto';
import { SettingsService } from '../services/settings.service';

const UPLOAD_BODY = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
};

function incoming(file: Express.Multer.File | undefined): IncomingFile {
  if (!file) {
    throw new BadRequestException({
      message: 'Attach the image as the multipart field "file"',
      code: 'FILE_REQUIRED',
    });
  }
  return { buffer: file.buffer, originalName: file.originalname };
}

/**
 * School settings (PRD 6.24). `GET /settings` returns every section with
 * defaults filled in; each `PATCH /settings/<section>` takes any subset of
 * that section (nested objects merge) and returns the section as saved.
 */
@ApiTags('Tenant / Settings')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ResponseMessage('Settings')
  findAll() {
    return this.settings.getAll();
  }

  /** Name, logo, colors and locale, for every signed-in member. */
  @Get('display')
  @ResponseMessage('Display settings')
  display() {
    return this.settings.getDisplay();
  }

  @Patch('organization')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Organization updated')
  updateOrganization(@Body() dto: UpdateOrganizationSettingsDto) {
    return this.settings.updateOrganization(dto);
  }

  @Patch('profile')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Profile settings updated')
  updateProfile(@Body() dto: UpdateProfileSettingsDto) {
    return this.settings.updateSection('profile', dto);
  }

  @Patch('locale')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Locale settings updated')
  updateLocale(@Body() dto: UpdateLocaleSettingsDto) {
    return this.settings.updateSection('locale', dto);
  }

  @Patch('numbering')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Numbering settings updated')
  updateNumbering(@Body() dto: UpdateNumberingSettingsDto) {
    return this.settings.updateSection('numbering', dto);
  }

  @Patch('portal')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Portal settings updated')
  updatePortal(@Body() dto: UpdatePortalSettingsDto) {
    return this.settings.updateSection('portal', dto);
  }

  @Patch('results')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Results settings updated')
  updateResults(@Body() dto: UpdateResultsSettingsDto) {
    return this.settings.updateSection('results', dto);
  }

  @Patch('attendance')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Attendance settings updated')
  updateAttendance(@Body() dto: UpdateAttendanceSettingsDto) {
    return this.settings.updateSection('attendance', dto);
  }

  @Patch('fees')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Fee settings updated')
  updateFees(@Body() dto: UpdateFeesSettingsDto) {
    return this.settings.updateSection('fees', dto);
  }

  @Patch('notifications')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Notification settings updated')
  updateNotifications(@Body() dto: UpdateNotificationSettingsDto) {
    return this.settings.updateSection('notifications', dto);
  }

  @Patch('security')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ResponseMessage('Security settings updated')
  updateSecurity(@Body() dto: UpdateSecuritySettingsDto) {
    return this.settings.updateSection('security', dto);
  }

  @Post('files/logo')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileUpload('org_logo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPLOAD_BODY)
  @ResponseMessage('Logo updated')
  uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    return this.settings.setLogo(incoming(file));
  }

  @Post('files/signature')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileUpload('signature'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPLOAD_BODY)
  @ResponseMessage('Principal signature updated')
  uploadSignature(@UploadedFile() file?: Express.Multer.File) {
    return this.settings.setPrincipalSignature(incoming(file));
  }
}
