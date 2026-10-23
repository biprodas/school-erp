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
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { StudentScope } from '../services/student-scope.service';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateStudentAddressDto } from '../dto/create-student-address.dto';
import { UpdateStudentAddressDto } from '../dto/update-student-address.dto';
import { StudentAddressService } from '../services/student-address.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Students')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('students/:studentId/addresses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentAddressController {
  constructor(
    private readonly addressService: StudentAddressService,
    private readonly scope: StudentScope,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  @ResponseMessage('Addresses')
  async list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.scope.assert(PERMISSIONS.STUDENTS_READ, studentId);
    return this.addressService.listForStudent(studentId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  @ResponseMessage('Address added')
  async create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentAddressDto,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENTS_CREATE, studentId);
    return this.addressService.create(studentId, dto);
  }

  @Patch(':addressId')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  @ResponseMessage('Address updated')
  async update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateStudentAddressDto,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENTS_UPDATE, studentId);
    return this.addressService.update(studentId, addressId, dto);
  }

  @Delete(':addressId')
  @RequirePermissions(PERMISSIONS.STUDENTS_DELETE)
  @ResponseMessage('Address removed')
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    await this.scope.assert(PERMISSIONS.STUDENTS_DELETE, studentId);
    await this.addressService.remove(studentId, addressId);
  }
}
