import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { FeeSetupService } from '~/modules/fees/services/fee-setup.service';
import { GradingService } from '~/modules/grading/services/grading.service';
import { HolidayService } from '~/modules/holidays/holiday.service';
import { ApplyHolidayTemplateDto } from '~/modules/holidays/dto/apply-holiday-template.dto';
import { ApplyTemplateDto } from '../dto/onboarding.dto';
import { OnboardingService } from '../services/onboarding.service';
import { CurriculumTemplateService } from '../services/curriculum-template.service';

/** Setup wizard (PRD 6.2) for the owner and school admins. */
@ApiTags('Tenant / Onboarding')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('onboarding')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly templates: CurriculumTemplateService,
    private readonly holidays: HolidayService,
    private readonly grading: GradingService,
    private readonly fees: FeeSetupService,
  ) {}

  @Get('checklist')
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ResponseMessage('Setup checklist')
  checklist() {
    return this.onboarding.checklist();
  }

  @Post('complete')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ResponseMessage('Setup completed')
  complete() {
    return this.onboarding.complete();
  }

  @Post('skip')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ResponseMessage('Setup skipped')
  skip() {
    return this.onboarding.skip();
  }

  @Get('templates')
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ResponseMessage('Setup templates')
  listTemplates() {
    return this.templates.list();
  }

  /** Adds the template's subjects, classes and groups (idempotent). */
  @Post('templates/curriculum/:code/apply')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ResponseMessage('Template applied')
  applyCurriculum(@Param('code') code: string, @Body() dto: ApplyTemplateDto) {
    return this.templates.applyCurriculum(code, dto.academicYearId);
  }

  /** Adds the default fee heads the school doesn't have yet (idempotent). */
  @Post('templates/fee-heads/apply')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ResponseMessage('Template applied')
  applyFeeHeads() {
    return this.fees.applyDefaultHeads();
  }

  /**
   * Creates a grading system from a template (once; the first one becomes
   * the school's default).
   */
  @Post('templates/grading/:code/apply')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ResponseMessage('Template applied')
  applyGrading(@Param('code') code: string) {
    return this.grading.applyTemplate(code);
  }

  /**
   * Adds Bangladesh's fixed-date government holidays for a year
   * (idempotent) and lists the moon-dependent ones to add by hand.
   */
  @Post('templates/holidays/bd/apply')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ONBOARDING_MANAGE)
  @ResponseMessage('Template applied')
  applyHolidays(@Body() dto: ApplyHolidayTemplateDto) {
    return this.holidays.applyBdTemplate(dto.year);
  }
}
