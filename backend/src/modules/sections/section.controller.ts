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
import { CreateSectionDto } from './dto/create-section.dto';
import { FilterSectionDto } from './dto/filter-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionService } from './section.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Sections')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('sections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SectionController {
  constructor(private readonly sectionService: SectionService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SECTIONS_READ)
  @ResponseMessage('List of sections')
  findAll(@Query() filter: FilterSectionDto) {
    return this.sectionService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SECTIONS_CREATE)
  @ResponseMessage('Section created')
  create(@Body() dto: CreateSectionDto) {
    return this.sectionService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_READ)
  @ResponseMessage('Section found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sectionService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_UPDATE)
  @ResponseMessage('Section updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.sectionService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_DELETE)
  @ResponseMessage('Section deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.sectionService.remove(id);
  }
}
