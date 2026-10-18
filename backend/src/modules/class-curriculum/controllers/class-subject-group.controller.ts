import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateClassSubjectGroupDto } from '../dto/create-class-subject-group.dto';
import { FilterClassSubjectGroupDto } from '../dto/filter-class-subject-group.dto';
import { ClassSubjectGroupService } from '../services/class-subject-group.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Class Subject Groups')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('class-subject-groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassSubjectGroupController {
  constructor(
    private readonly classSubjectGroupService: ClassSubjectGroupService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECT_GROUPS_READ)
  @ResponseMessage('List of class subject groups')
  findAll(@Query() filter: FilterClassSubjectGroupDto) {
    return this.classSubjectGroupService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECT_GROUPS_CREATE)
  @ResponseMessage('Class subject group created')
  create(@Body() dto: CreateClassSubjectGroupDto) {
    return this.classSubjectGroupService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECT_GROUPS_READ)
  @ResponseMessage('Class subject group found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.classSubjectGroupService.findById(id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECT_GROUPS_DELETE)
  @ResponseMessage('Class subject group deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.classSubjectGroupService.remove(id);
  }
}
