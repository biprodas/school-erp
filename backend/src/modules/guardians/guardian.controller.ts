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
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { FilterGuardianDto } from './dto/filter-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { GuardianService } from './guardian.service';

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
  async findAll(@Query() filter: FilterGuardianDto) {
    const guardians = await this.guardianService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of guardians',
      data: guardians,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GUARDIANS_CREATE)
  async create(@Body() dto: CreateGuardianDto) {
    const guardian = await this.guardianService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Guardian created. ID: ${guardian.id}`,
      data: guardian,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.GUARDIANS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const guardian = await this.guardianService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Guardian found. ID: ${guardian.id}`,
      data: guardian,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GUARDIANS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuardianDto,
  ) {
    const guardian = await this.guardianService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Guardian updated. ID: ${guardian.id}`,
      data: guardian,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.GUARDIANS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.guardianService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Guardian deleted. ID: ${id}`,
    };
  }
}
