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
import { CreateSectionDto } from './dto/create-section.dto';
import { FilterSectionDto } from './dto/filter-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionService } from './section.service';

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
  async findAll(@Query() filter: FilterSectionDto) {
    const sections = await this.sectionService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of sections',
      data: sections,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SECTIONS_CREATE)
  async create(@Body() dto: CreateSectionDto) {
    const section = await this.sectionService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Section created. ID: ${section.id}`,
      data: section,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const section = await this.sectionService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Section found. ID: ${section.id}`,
      data: section,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    const section = await this.sectionService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Section updated. ID: ${section.id}`,
      data: section,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.sectionService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Section deleted. ID: ${id}`,
    };
  }
}
