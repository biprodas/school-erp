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
import {
  PERMISSIONS,
  type PermissionKey,
} from '~/modules/rbac/permissions.catalog';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { TransferEnrollmentDto } from '../dto/transfer-enrollment.dto';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateEnrollmentDto } from '../dto/create-enrollment.dto';
import { FilterEnrollmentDto } from '../dto/filter-enrollment.dto';
import { UpdateEnrollmentDto } from '../dto/update-enrollment.dto';
import { EnrollmentService } from '../services/enrollment.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Enrollments')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('enrollments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EnrollmentController {
  constructor(
    private readonly enrollmentService: EnrollmentService,
    private readonly scope: AccessScope,
  ) {}

  /** A teacher with assigned scope sees their sections' enrollments. */
  @Get()
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_READ)
  @ResponseMessage('List of enrollments')
  async findAll(@Query() filter: FilterEnrollmentDto) {
    const allowed = await this.scope.sections(PERMISSIONS.ENROLLMENTS_READ);
    return this.enrollmentService.findFiltered(filter, allowed);
  }

  /**
   * Places an active student (capacity, roll and placement checked). A
   * full section takes `overrideCapacity` with the override permission.
   */
  @Post()
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_CREATE)
  @ResponseMessage('Enrollment created')
  async create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentService.create(dto, await this.options());
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_READ)
  @ResponseMessage('Enrollment found')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const enrollment = await this.enrollmentService.findById(id);
    await this.assertSection(
      PERMISSIONS.ENROLLMENTS_READ,
      enrollment.sectionId,
    );
    return enrollment;
  }

  /** To another section (or shift) of the same class; kept as history. */
  @Post(':id/transfer')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_UPDATE)
  @ResponseMessage('Student transferred')
  async transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferEnrollmentDto,
  ) {
    return this.enrollmentService.transfer(id, dto, await this.options());
  }

  @Get(':id/transfers')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_READ)
  @ResponseMessage('Transfer history')
  async transfers(@Param('id', ParseUUIDPipe) id: string) {
    const enrollment = await this.enrollmentService.findById(id);
    await this.assertSection(
      PERMISSIONS.ENROLLMENTS_READ,
      enrollment.sectionId,
    );
    return this.enrollmentService.transferHistory(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_UPDATE)
  @ResponseMessage('Enrollment updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_DELETE)
  @ResponseMessage('Enrollment deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.enrollmentService.remove(id);
  }

  private async options() {
    return {
      canOverrideCapacity: await this.scope.can(
        PERMISSIONS.ENROLLMENTS_OVERRIDE_CAPACITY,
      ),
    };
  }

  private async assertSection(key: PermissionKey, sectionId: string) {
    if (!(await this.scope.canAccessSection(key, sectionId))) {
      throw new NotFoundException('Enrollment not found');
    }
  }
}
