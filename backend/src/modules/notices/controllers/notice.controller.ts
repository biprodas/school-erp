import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '~/common/auth/auth-user';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import {
  FileUpload,
  requireFile,
} from '~/modules/files/file-upload.interceptor';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  CreateNoticeDto,
  FilterNoticeDto,
  UpdateNoticeDto,
} from '../dto/notice.dto';
import { NoticeService } from '../services/notice.service';

/**
 * The notice board (PRD 6.13). The feed is for every member (staff and
 * portal); writing needs `notices:manage` (teachers: their sections).
 */
@ApiTags('Tenant / Notices')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('notices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NoticeController {
  constructor(
    private readonly notices: NoticeService,
    private readonly scope: AccessScope,
  ) {}

  /** The notices the signed-in user's audience reaches. */
  @Get('feed')
  @ResponseMessage('Notice feed')
  feed(@CurrentUser() user: AuthUser, @Query() page: PaginationQueryDto) {
    return this.notices.feed(user.userId, page);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.NOTICES_READ, PERMISSIONS.NOTICES_MANAGE)
  @ResponseMessage('Notices')
  findAll(@Query() filter: FilterNoticeDto) {
    return this.notices.list(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.NOTICES_MANAGE)
  @ResponseMessage('Notice created')
  async create(@Body() dto: CreateNoticeDto) {
    return this.notices.create(dto, await this.allowed());
  }

  /** Multipart `file`; pass its id in `attachmentFileIds`. */
  @Post('attachments')
  @RequirePermissions(PERMISSIONS.NOTICES_MANAGE)
  @UseInterceptors(FileUpload('attachment'))
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Attachment uploaded')
  upload(@UploadedFile() file?: Express.Multer.File) {
    return this.notices.uploadAttachment(requireFile(file));
  }

  /** A notice the viewer can see. */
  @Get(':id')
  @ResponseMessage('Notice')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notices.findForViewer(id, user.userId);
  }

  @Post(':id/read')
  @HttpCode(200)
  @ResponseMessage('Read')
  async read(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notices.markRead(id, user.userId);
  }

  @Get(':id/attachments/:fileId')
  @ResponseMessage('Download link')
  attachment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.notices.attachmentUrl(id, fileId, user.userId);
  }

  /** Read receipts: the audience's size and who has read it. */
  @Get(':id/reads')
  @RequirePermissions(PERMISSIONS.NOTICES_READ, PERMISSIONS.NOTICES_MANAGE)
  @ResponseMessage('Read receipts')
  reads(@Param('id', ParseUUIDPipe) id: string) {
    return this.notices.reads(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.NOTICES_MANAGE)
  @ResponseMessage('Notice updated')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    return this.notices.update(id, dto, await this.allowed());
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.NOTICES_MANAGE)
  @ResponseMessage('Notice deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.notices.remove(id, await this.allowed());
  }

  private allowed() {
    return this.scope.sections(PERMISSIONS.NOTICES_MANAGE);
  }
}
