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
import { CreateClassTeacherDto } from './dto/create-class-teacher.dto';
import { FilterClassTeacherDto } from './dto/filter-class-teacher.dto';
import { UpdateClassTeacherDto } from './dto/update-class-teacher.dto';
import { ClassTeacherService } from './class-teacher.service';

@ApiTags('Tenant / Class Teachers')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('class-teachers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassTeacherController {
  constructor(private readonly classTeacherService: ClassTeacherService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_READ)
  async findAll(@Query() filter: FilterClassTeacherDto) {
    const items = await this.classTeacherService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of class teachers',
      data: items,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_CREATE)
  async create(@Body() dto: CreateClassTeacherDto) {
    const item = await this.classTeacherService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Class teacher assigned. ID: ${item.id}`,
      data: item,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.classTeacherService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Class teacher found. ID: ${item.id}`,
      data: item,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassTeacherDto,
  ) {
    const item = await this.classTeacherService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Class teacher updated. ID: ${item.id}`,
      data: item,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.classTeacherService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Class teacher removed. ID: ${id}`,
    };
  }
}
