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
import { AttachSectionDto } from '../dto/attach-section.dto';
import { UpdateClassSectionDto } from '../dto/update-class-section.dto';
import { ClassService } from '../services/class.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Classes')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('classes/:classId/sections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassSectionController {
  constructor(private readonly classService: ClassService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLASSES_READ)
  @ResponseMessage('Sections')
  list(@Param('classId', ParseUUIDPipe) classId: string) {
    return this.classService.listSections(classId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASSES_UPDATE)
  @ResponseMessage('Section attached')
  attach(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: AttachSectionDto,
  ) {
    return this.classService.attachSection(classId, dto);
  }

  @Patch(':linkId')
  @RequirePermissions(PERMISSIONS.CLASSES_UPDATE)
  @ResponseMessage('Class section updated')
  updateLink(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: UpdateClassSectionDto,
  ) {
    return this.classService.updateSection(classId, linkId, dto);
  }

  @Delete(':linkId')
  @RequirePermissions(PERMISSIONS.CLASSES_UPDATE)
  @ResponseMessage('Section detached from class')
  async detach(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.classService.detachSection(classId, linkId);
  }
}
