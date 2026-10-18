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
import { CreateClassDto } from '../dto/create-class.dto';
import { FilterClassDto } from '../dto/filter-class.dto';
import { UpdateClassDto } from '../dto/update-class.dto';
import { ClassService } from '../services/class.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('List of classes')
  findAll(@Query() filter: FilterClassDto) {
    return this.classService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASSES_CREATE)
  @ResponseMessage('Class created')
  create(@Body() dto: CreateClassDto) {
    return this.classService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLASSES_READ)
  @ResponseMessage('Class found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.classService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLASSES_UPDATE)
  @ResponseMessage('Class updated')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClassDto) {
    return this.classService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLASSES_DELETE)
  @ResponseMessage('Class deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.classService.remove(id);
  }
}
