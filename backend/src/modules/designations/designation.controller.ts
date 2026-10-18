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
import { CreateDesignationDto } from './dto/create-designation.dto';
import { FilterDesignationDto } from './dto/filter-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { DesignationService } from './designation.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Designations')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('designations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DesignationController {
  constructor(private readonly designationService: DesignationService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_READ)
  @ResponseMessage('List of designations')
  findAll(@Query() filter: FilterDesignationDto) {
    return this.designationService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_CREATE)
  @ResponseMessage('Designation created')
  create(@Body() dto: CreateDesignationDto) {
    return this.designationService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_READ)
  @ResponseMessage('Designation found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.designationService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_UPDATE)
  @ResponseMessage('Designation updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    return this.designationService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DESIGNATIONS_DELETE)
  @ResponseMessage('Designation deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.designationService.remove(id);
  }
}
