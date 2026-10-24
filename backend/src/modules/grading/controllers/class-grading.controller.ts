import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  FilterClassGradingDto,
  SetClassGradingDto,
} from '../dto/grading-system.dto';
import { GradingService } from '../services/grading.service';

/** Which grading system a class uses in a session (else the default). */
@ApiTags('Tenant / Grading')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('class-grading')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassGradingController {
  constructor(private readonly grading: GradingService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_READ)
  @ResponseMessage('Class grading')
  findAll(@Query() filter: FilterClassGradingDto) {
    return this.grading.listClassGrading(filter.academicYearId);
  }

  /** Sets (or changes) a class's system for the session. */
  @Put()
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_UPDATE)
  @ResponseMessage('Class grading saved')
  set(@Body() dto: SetClassGradingDto) {
    return this.grading.setClassGrading(dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.GRADING_SYSTEMS_UPDATE)
  @ResponseMessage('Class grading removed')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.grading.removeClassGrading(id);
  }
}
