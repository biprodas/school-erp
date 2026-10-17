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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { AttachGroupSubjectDto } from './dto/attach-group-subject.dto';
import { UpdateGroupSubjectDto } from './dto/update-group-subject.dto';
import { SubjectGroupService } from './subject-group.service';

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
  async list(@Param('groupId', ParseUUIDPipe) groupId: string) {
    const links = await this.subjectGroupService.listSubjects(groupId);
    return {
      success: true,
      statusCode: 200,
      message: `Subjects of group ${groupId}`,
      data: links,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_UPDATE)
  async attach(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AttachGroupSubjectDto,
  ) {
    const link = await this.subjectGroupService.attachSubject(groupId, dto);
    return {
      success: true,
      statusCode: 201,
      message: `Subject added to group ${groupId}. Link ID: ${link.id}`,
      data: link,
    };
  }

  @Patch(':linkId')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_UPDATE)
  async updateLink(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: UpdateGroupSubjectDto,
  ) {
    const link = await this.subjectGroupService.updateSubject(
      groupId,
      linkId,
      dto,
    );
    return {
      success: true,
      statusCode: 200,
      message: `Group subject updated. Link ID: ${link.id}`,
      data: link,
    };
  }

  @Delete(':linkId')
  @RequirePermissions(PERMISSIONS.SUBJECT_GROUPS_UPDATE)
  async detach(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.subjectGroupService.detachSubject(groupId, linkId);
    return {
      success: true,
      statusCode: 200,
      message: `Subject removed from group. Link ID: ${linkId}`,
    };
  }
}
