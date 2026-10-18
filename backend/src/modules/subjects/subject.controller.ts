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
import { CreateSubjectDto } from './dto/create-subject.dto';
import { FilterSubjectDto } from './dto/filter-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectService } from './subject.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Subjects')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('subjects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SUBJECTS_READ)
  @ResponseMessage('List of subjects')
  findAll(@Query() filter: FilterSubjectDto) {
    return this.subjectService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUBJECTS_CREATE)
  @ResponseMessage('Subject created')
  create(@Body() dto: CreateSubjectDto) {
    return this.subjectService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SUBJECTS_READ)
  @ResponseMessage('Subject found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SUBJECTS_UPDATE)
  @ResponseMessage('Subject updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SUBJECTS_DELETE)
  @ResponseMessage('Subject deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.subjectService.remove(id);
  }
}
