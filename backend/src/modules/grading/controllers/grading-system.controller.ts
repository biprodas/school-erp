import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  CreateFromTemplateDto,
  CreateGradingSystemDto,
  ReplaceScaleDto,
  UpdateGradingSystemDto,
} from '../dto/grading-system.dto';
import { GradingService } from '../services/grading.service';

/** Grade scales and grading rules (PRD 6.9). */
@ApiTags('Tenant / Grading')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('grading-systems')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GradingSystemController {
  constructor(private readonly grading: GradingService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_READ)
  @ResponseMessage('Grading systems')
  findAll() {
    return this.grading.findAll();
  }

  /** BD GPA 5.0, GPA 4.0, Cambridge, percentage/division, Alia madrasa. */
  @Get('templates')
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_READ)
  @ResponseMessage('Grading templates')
  templates() {
    return this.grading.templates();
  }

  @Post('templates/:code')
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_CREATE)
  @ResponseMessage('Grading system created')
  fromTemplate(
    @Param('code') code: string,
    @Body() dto: CreateFromTemplateDto,
  ) {
    return this.grading.createFromTemplate(code, dto);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_CREATE)
  @ResponseMessage('Grading system created')
  create(@Body() dto: CreateGradingSystemDto) {
    return this.grading.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_READ)
  @ResponseMessage('Grading system')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.grading.findById(id);
  }

  /** Name, default flag, or some of the rules. */
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_UPDATE)
  @ResponseMessage('Grading system updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradingSystemDto,
  ) {
    return this.grading.update(id, dto);
  }

  /** Replaces the whole grade scale. */
  @Put(':id/scale')
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_UPDATE)
  @ResponseMessage('Grade scale saved')
  replaceScale(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceScaleDto,
  ) {
    return this.grading.replaceScale(id, dto.items);
  }

  /** Refused (409) while a class uses it. */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_DELETE)
  @ResponseMessage('Grading system deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.grading.remove(id);
  }
}
