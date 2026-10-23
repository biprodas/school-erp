import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import {
  CreateClassSubjectComponentDto,
  UpdateClassSubjectComponentDto,
} from '../dto/class-subject-component.dto';
import { ClassSubjectService } from '../services/class-subject.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

/** CQ / MCQ / practical / written / oral parts of a class subject. */
@ApiTags('Tenant / Class Subjects')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('class-subjects/:classSubjectId/components')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassSubjectComponentController {
  constructor(private readonly classSubjectService: ClassSubjectService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_READ)
  @ResponseMessage('Subject components')
  list(@Param('classSubjectId', ParseUUIDPipe) classSubjectId: string) {
    return this.classSubjectService.listComponents(classSubjectId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_UPDATE)
  @ResponseMessage('Subject component added')
  add(
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Body() dto: CreateClassSubjectComponentDto,
  ) {
    return this.classSubjectService.addComponent(classSubjectId, dto);
  }

  @Patch(':componentId')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_UPDATE)
  @ResponseMessage('Subject component updated')
  update(
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @Body() dto: UpdateClassSubjectComponentDto,
  ) {
    return this.classSubjectService.updateComponent(
      classSubjectId,
      componentId,
      dto,
    );
  }

  @Delete(':componentId')
  @RequirePermissions(PERMISSIONS.CLASS_SUBJECTS_UPDATE)
  @ResponseMessage('Subject component removed')
  async remove(
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('componentId', ParseUUIDPipe) componentId: string,
  ) {
    await this.classSubjectService.removeComponent(classSubjectId, componentId);
  }
}
