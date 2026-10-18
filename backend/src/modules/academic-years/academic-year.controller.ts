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
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { FilterAcademicYearDto } from './dto/filter-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { AcademicYearService } from './academic-year.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('List of academic years')
  findAll(@Query() filter: FilterAcademicYearDto) {
    return this.academicYearService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_CREATE)
  @ResponseMessage('Academic year created')
  create(@Body() dto: CreateAcademicYearDto) {
    return this.academicYearService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_READ)
  @ResponseMessage('Academic year found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.academicYearService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_UPDATE)
  @ResponseMessage('Academic year updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.academicYearService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEARS_DELETE)
  @ResponseMessage('Academic year deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.academicYearService.remove(id);
  }
}
