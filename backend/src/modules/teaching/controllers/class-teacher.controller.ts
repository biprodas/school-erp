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
import { CreateClassTeacherDto } from '../dto/create-class-teacher.dto';
import { FilterClassTeacherDto } from '../dto/filter-class-teacher.dto';
import { UpdateClassTeacherDto } from '../dto/update-class-teacher.dto';
import { ClassTeacherService } from '../services/class-teacher.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('List of class teachers')
  findAll(@Query() filter: FilterClassTeacherDto) {
    return this.classTeacherService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_CREATE)
  @ResponseMessage('Class teacher assigned')
  create(@Body() dto: CreateClassTeacherDto) {
    return this.classTeacherService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_READ)
  @ResponseMessage('Class teacher found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.classTeacherService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_UPDATE)
  @ResponseMessage('Class teacher updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassTeacherDto,
  ) {
    return this.classTeacherService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_DELETE)
  @ResponseMessage('Class teacher removed')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.classTeacherService.remove(id);
  }
}
