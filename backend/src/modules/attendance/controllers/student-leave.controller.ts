import { Throttle } from '@nestjs/throttler';
import { UPLOAD_THROTTLE } from '~/common/throttling/throttle.constants';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
  CreateStudentLeaveDto,
  DecideStudentLeaveDto,
  FilterStudentLeaveDto,
} from '../dto/student-leave.dto';
import { StudentLeaveService } from '../services/student-leave.service';

/**
 * Student leave requests (PRD 6.7) on the staff side. Reading follows the
 * caller's sections; deciding belongs to the class teacher (or a
 * school-wide role such as the principal).
 */
@ApiTags('Tenant / Student leave')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('student-leaves')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentLeaveController {
  constructor(
    private readonly leaves: StudentLeaveService,
    private readonly scope: AccessScope,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENT_LEAVES_READ)
  @ResponseMessage('Leave requests')
  async findAll(@Query() filter: FilterStudentLeaveDto) {
    return this.leaves.findFiltered(filter, await this.readable());
  }

  /** Entered on a guardian's behalf; guardians apply through the portal. */
  @Post()
  @RequirePermissions(PERMISSIONS.STUDENT_LEAVES_CREATE)
  @ResponseMessage('Leave request created')
  async create(@Body() dto: CreateStudentLeaveDto) {
    return this.leaves.create(
      dto,
      await this.scope.sections(PERMISSIONS.STUDENT_LEAVES_CREATE),
    );
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STUDENT_LEAVES_READ)
  @ResponseMessage('Leave request')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaves.findById(id, await this.readable());
  }

  /** Multipart `file` (image or PDF), e.g. a doctor's note. */
  @Post(':id/attachment')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.STUDENT_LEAVES_CREATE)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileUpload('attachment'))
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Attachment added')
  async attach(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.leaves.attach(
      id,
      requireFile(file),
      await this.scope.sections(PERMISSIONS.STUDENT_LEAVES_CREATE),
    );
  }

  @Get(':id/attachment')
  @RequirePermissions(PERMISSIONS.STUDENT_LEAVES_READ)
  @ResponseMessage('Download link')
  async attachment(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaves.attachmentUrl(id, await this.readable());
  }

  /** Approves and sets Leave in registers already taken for those days. */
  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.STUDENT_LEAVES_APPROVE)
  @ResponseMessage('Leave approved')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideStudentLeaveDto,
  ) {
    return this.leaves.approve(id, dto, await this.decidable(id));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.STUDENT_LEAVES_APPROVE)
  @ResponseMessage('Leave rejected')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideStudentLeaveDto,
  ) {
    return this.leaves.reject(id, dto, await this.decidable(id));
  }

  /** Withdraws a pending request. */
  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.STUDENT_LEAVES_CREATE)
  @ResponseMessage('Leave request cancelled')
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaves.cancel(
      id,
      await this.scope.sections(PERMISSIONS.STUDENT_LEAVES_CREATE),
    );
  }

  private readable() {
    return this.scope.sections(PERMISSIONS.STUDENT_LEAVES_READ);
  }

  /**
   * The sections whose leave the caller decides: their class-teacher
   * sections. 404 when they can't see the request at all, 403 when they
   * can but don't decide it.
   */
  private async decidable(id: string): Promise<string[] | null> {
    const home = await this.scope.homeSections(
      PERMISSIONS.STUDENT_LEAVES_APPROVE,
    );
    if (home === null) return null;
    const leave = await this.leaves.findById(id, await this.readable());
    if (!home.includes(leave.enrollment!.sectionId)) {
      throw new ForbiddenException({
        message: "Only the section's class teacher decides this request",
        code: 'NOT_CLASS_TEACHER',
      });
    }
    return home;
  }
}
