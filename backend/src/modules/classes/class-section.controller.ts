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
import { AttachSectionDto } from './dto/attach-section.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';
import { ClassService } from './class.service';

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
  async list(@Param('classId', ParseUUIDPipe) classId: string) {
    const links = await this.classService.listSections(classId);
    return {
      success: true,
      statusCode: 200,
      message: `Sections of class ${classId}`,
      data: links,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASSES_UPDATE)
  async attach(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: AttachSectionDto,
  ) {
    const link = await this.classService.attachSection(classId, dto);
    return {
      success: true,
      statusCode: 201,
      message: `Section attached to class ${classId}. Link ID: ${link.id}`,
      data: link,
    };
  }

  @Patch(':linkId')
  @RequirePermissions(PERMISSIONS.CLASSES_UPDATE)
  async updateLink(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: UpdateClassSectionDto,
  ) {
    const link = await this.classService.updateSection(classId, linkId, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Class section updated. Link ID: ${link.id}`,
      data: link,
    };
  }

  @Delete(':linkId')
  @RequirePermissions(PERMISSIONS.CLASSES_UPDATE)
  async detach(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.classService.detachSection(classId, linkId);
    return {
      success: true,
      statusCode: 200,
      message: `Section detached from class. Link ID: ${linkId}`,
    };
  }
}
