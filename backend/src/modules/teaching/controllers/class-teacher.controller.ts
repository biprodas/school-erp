import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import {
  ChangeClassTeacherDto,
  EndAssignmentDto,
} from '../dto/change-assignment.dto';
import { CreateClassTeacherDto } from '../dto/create-class-teacher.dto';
import { FilterClassTeacherDto } from '../dto/filter-class-teacher.dto';
import { ClassTeacherService } from '../services/class-teacher.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

/**
 * Class teachers per section (PRD 6.4), effective-dated.
 * Lists follow the scope rules (a teacher sees their own sections only);
 * `?current=true` or `?on=YYYY-MM-DD` narrow them in time.
 */
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
  constructor(
    private readonly classTeacherService: ClassTeacherService,
    private readonly scope: AccessScope,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_READ)
  @ResponseMessage('List of class teachers')
  async findAll(@Query() filter: FilterClassTeacherDto) {
    const allowed = await this.scope.sections(PERMISSIONS.CLASS_TEACHERS_READ);
    return this.classTeacherService.findFiltered(filter, allowed);
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
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.classTeacherService.findById(id);
    if (
      !(await this.scope.canAccessSection(
        PERMISSIONS.CLASS_TEACHERS_READ,
        row.sectionId,
      ))
    ) {
      throw new NotFoundException('Assignment not found');
    }
    return row;
  }

  /** Hand over to another teacher, or correct the current row. */
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_UPDATE)
  @ResponseMessage('Class teacher changed')
  change(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeClassTeacherDto,
  ) {
    return this.classTeacherService.change(id, dto);
  }

  /** End-date the assignment (kept as history). */
  @Post(':id/end')
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_UPDATE)
  @ResponseMessage('Class teacher ended')
  end(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndAssignmentDto) {
    return this.classTeacherService.end(id, dto);
  }

  /** Only a current row created in error; ended rows are history (409). */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLASS_TEACHERS_DELETE)
  @ResponseMessage('Class teacher removed')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.classTeacherService.remove(id);
  }
}
