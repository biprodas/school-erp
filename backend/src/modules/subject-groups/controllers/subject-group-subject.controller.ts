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
import { AttachGroupSubjectDto } from '../dto/attach-group-subject.dto';
import { UpdateGroupSubjectDto } from '../dto/update-group-subject.dto';
import { SubjectGroupService } from '../services/subject-group.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Subject Groups')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('subject-groups/:groupId/subjects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubjectGroupSubjectController {
  constructor(private readonly subjectGroupService: SubjectGroupService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_READ)
  @ResponseMessage('Subjects')
  list(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.subjectGroupService.listSubjects(groupId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_UPDATE)
  @ResponseMessage('Subject added')
  attach(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AttachGroupSubjectDto,
  ) {
    return this.subjectGroupService.attachSubject(groupId, dto);
  }

  @Patch(':linkId')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_UPDATE)
  @ResponseMessage('Group subject updated')
  updateLink(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: UpdateGroupSubjectDto,
  ) {
    return this.subjectGroupService.updateSubject(groupId, linkId, dto);
  }

  @Delete(':linkId')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_UPDATE)
  @ResponseMessage('Subject removed from group')
  async detach(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.subjectGroupService.detachSubject(groupId, linkId);
  }
}
