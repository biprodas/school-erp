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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateStakeholderDto } from './dto/create-stakeholder.dto';
import { FilterStakeholderDto } from './dto/filter-stakeholder.dto';
import { UpdateStakeholderDto } from './dto/update-stakeholder.dto';
import { StakeholderService } from './stakeholder.service';

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
  async findAll(@Query() filter: FilterStakeholderDto) {
    const stakeholders = await this.stakeholderService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of stakeholders',
      data: stakeholders,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STAKEHOLDERS_CREATE)
  async create(@Body() dto: CreateStakeholderDto) {
    const stakeholder = await this.stakeholderService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Stakeholder created. ID: ${stakeholder.id}`,
      data: stakeholder,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STAKEHOLDERS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const stakeholder = await this.stakeholderService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Stakeholder found. ID: ${stakeholder.id}`,
      data: stakeholder,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.STAKEHOLDERS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStakeholderDto,
  ) {
    const stakeholder = await this.stakeholderService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Stakeholder updated. ID: ${stakeholder.id}`,
      data: stakeholder,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.STAKEHOLDERS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.stakeholderService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Stakeholder deleted. ID: ${id}`,
    };
  }
}
