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
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { FilterAcademicYearDto } from './dto/filter-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { AcademicYearService } from './academic-year.service';

@ApiTags('Tenant / Academic Years')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('academic-years')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AcademicYearController {
  constructor(private readonly academicYearService: AcademicYearService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_READ)
  async findAll(@Query() filter: FilterAcademicYearDto) {
    const academicYears = await this.academicYearService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of academic years',
      data: academicYears,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_CREATE)
  async create(@Body() dto: CreateAcademicYearDto) {
    const academicYear = await this.academicYearService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Academic year created. ID: ${academicYear.id}`,
      data: academicYear,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const academicYear = await this.academicYearService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Academic year found. ID: ${academicYear.id}`,
      data: academicYear,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    const academicYear = await this.academicYearService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Academic year updated. ID: ${academicYear.id}`,
      data: academicYear,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.academicYearService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Academic year deleted. ID: ${id}`,
    };
  }
}
