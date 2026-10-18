import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateGuardianDto } from '../dto/create-guardian.dto';
import { FilterGuardianDto } from '../dto/filter-guardian.dto';
import { UpdateGuardianDto } from '../dto/update-guardian.dto';
import { GuardianService } from '../services/guardian.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Guardians')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('guardians')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GuardianController {
  constructor(private readonly guardianService: GuardianService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.GUARDIANS_READ)
  @ResponseMessage('List of guardians')
  findAll(@Query() filter: FilterGuardianDto) {
    return this.guardianService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GUARDIANS_CREATE)
  @ResponseMessage('Guardian created')
  create(@Body() dto: CreateGuardianDto) {
    return this.guardianService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.GUARDIANS_READ)
  @ResponseMessage('Guardian found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.guardianService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GUARDIANS_UPDATE)
  @ResponseMessage('Guardian updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuardianDto,
  ) {
    return this.guardianService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.GUARDIANS_DELETE)
  @ResponseMessage('Guardian deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.guardianService.remove(id);
  }
}
