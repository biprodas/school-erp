import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { FilterSectionDto } from './dto/filter-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionService } from './section.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

/**
 * Sections per class and session. Reads follow the scope rules: a teacher
 * with assigned scope sees only the sections they teach in.
 */
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
  constructor(
    private readonly sectionService: SectionService,
    private readonly scope: AccessScope,
  ) {}

  /** `?academicYearId=&classId=` narrow the list. */
  @Get()
  @RequirePermissions(PERMISSIONS.SECTIONS_READ)
  @ResponseMessage('List of sections')
  async findAll(@Query() filter: FilterSectionDto) {
    const allowed = await this.scope.sections(PERMISSIONS.SECTIONS_READ);
    return this.sectionService.findFiltered(filter, allowed);
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
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    if (!(await this.scope.canAccessSection(PERMISSIONS.SECTIONS_READ, id))) {
      // Same answer as a missing one: no probing other sections.
      throw new NotFoundException(`Section with id "${id}" not found`);
    }
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

  /** Refused (409) while students are enrolled in the section. */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_DELETE)
  @ResponseMessage('Section deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.sectionService.remove(id);
  }
}
