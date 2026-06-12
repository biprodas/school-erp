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
import { CreateClassDto } from './dto/create-class.dto';
import { FilterClassDto } from './dto/filter-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassService } from './class.service';

@ApiTags('Tenant / Classes')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('classes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLASSES_READ)
  async findAll(@Query() filter: FilterClassDto) {
    const classes = await this.classService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of classes',
      data: classes,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASSES_CREATE)
  async create(@Body() dto: CreateClassDto) {
    const cls = await this.classService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Class created. ID: ${cls.id}`,
      data: cls,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLASSES_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const cls = await this.classService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Class found. ID: ${cls.id}`,
      data: cls,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLASSES_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
  ) {
    const cls = await this.classService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Class updated. ID: ${cls.id}`,
      data: cls,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLASSES_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.classService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Class deleted. ID: ${id}`,
    };
  }
}
