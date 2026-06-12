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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateClassSubjectDto } from './dto/create-class-subject.dto';
import { FilterClassSubjectDto } from './dto/filter-class-subject.dto';
import { UpdateClassSubjectDto } from './dto/update-class-subject.dto';
import { ClassSubjectService } from './class-subject.service';

@ApiTags('Tenant / Class Subjects')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('class-subjects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassSubjectController {
  constructor(private readonly classSubjectService: ClassSubjectService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_READ)
  async findAll(@Query() filter: FilterClassSubjectDto) {
    const items = await this.classSubjectService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of class subjects',
      data: items,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_CREATE)
  async create(@Body() dto: CreateClassSubjectDto) {
    const item = await this.classSubjectService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Class subject created. ID: ${item.id}`,
      data: item,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.classSubjectService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Class subject found. ID: ${item.id}`,
      data: item,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassSubjectDto,
  ) {
    const item = await this.classSubjectService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Class subject updated. ID: ${item.id}`,
      data: item,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.classSubjectService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Class subject deleted. ID: ${id}`,
    };
  }
}
