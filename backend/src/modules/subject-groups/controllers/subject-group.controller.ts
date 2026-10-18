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
import { CreateSubjectGroupDto } from '../dto/create-subject-group.dto';
import { FilterSubjectGroupDto } from '../dto/filter-subject-group.dto';
import { UpdateSubjectGroupDto } from '../dto/update-subject-group.dto';
import { SubjectGroupService } from '../services/subject-group.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Subject Groups')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('subject-groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubjectGroupController {
  constructor(private readonly subjectGroupService: SubjectGroupService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_READ)
  @ResponseMessage('List of subject groups')
  findAll(@Query() filter: FilterSubjectGroupDto) {
    return this.subjectGroupService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_CREATE)
  @ResponseMessage('Subject group created')
  create(@Body() dto: CreateSubjectGroupDto) {
    return this.subjectGroupService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_READ)
  @ResponseMessage('Subject group found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectGroupService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_UPDATE)
  @ResponseMessage('Subject group updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectGroupDto,
  ) {
    return this.subjectGroupService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_DELETE)
  @ResponseMessage('Subject group deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.subjectGroupService.remove(id);
  }
}
