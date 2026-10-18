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
import { CreateClassSubjectDto } from '../dto/create-class-subject.dto';
import { FilterClassSubjectDto } from '../dto/filter-class-subject.dto';
import { UpdateClassSubjectDto } from '../dto/update-class-subject.dto';
import { ClassSubjectService } from '../services/class-subject.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('List of class subjects')
  findAll(@Query() filter: FilterClassSubjectDto) {
    return this.classSubjectService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_CREATE)
  @ResponseMessage('Class subject created')
  create(@Body() dto: CreateClassSubjectDto) {
    return this.classSubjectService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_READ)
  @ResponseMessage('Class subject found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.classSubjectService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_UPDATE)
  @ResponseMessage('Class subject updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassSubjectDto,
  ) {
    return this.classSubjectService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_DELETE)
  @ResponseMessage('Class subject deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.classSubjectService.remove(id);
  }
}
