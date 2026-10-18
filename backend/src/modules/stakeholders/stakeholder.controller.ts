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
import { CreateStakeholderDto } from './dto/create-stakeholder.dto';
import { FilterStakeholderDto } from './dto/filter-stakeholder.dto';
import { UpdateStakeholderDto } from './dto/update-stakeholder.dto';
import { StakeholderService } from './stakeholder.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Stakeholders')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('stakeholders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StakeholderController {
  constructor(private readonly stakeholderService: StakeholderService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STAKEHOLDERS_READ)
  @ResponseMessage('List of stakeholders')
  findAll(@Query() filter: FilterStakeholderDto) {
    return this.stakeholderService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STAKEHOLDERS_CREATE)
  @ResponseMessage('Stakeholder created')
  create(@Body() dto: CreateStakeholderDto) {
    return this.stakeholderService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STAKEHOLDERS_READ)
  @ResponseMessage('Stakeholder found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.stakeholderService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.STAKEHOLDERS_UPDATE)
  @ResponseMessage('Stakeholder updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStakeholderDto,
  ) {
    return this.stakeholderService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.STAKEHOLDERS_DELETE)
  @ResponseMessage('Stakeholder deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.stakeholderService.remove(id);
  }
}
