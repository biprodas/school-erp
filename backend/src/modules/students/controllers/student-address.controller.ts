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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PERMISSIONS } from '../../rbac/permissions.catalog';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/require-permissions.decorator';
import { CreateStudentAddressDto } from '../dto/create-student-address.dto';
import { UpdateStudentAddressDto } from '../dto/update-student-address.dto';
import { StudentAddressService } from '../services/student-address.service';

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
  constructor(private readonly addressService: StudentAddressService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  async list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    const addresses = await this.addressService.listForStudent(studentId);
    return {
      success: true,
      statusCode: 200,
      message: `Addresses of student ${studentId}`,
      data: addresses,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  async create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentAddressDto,
  ) {
    const address = await this.addressService.create(studentId, dto);
    return {
      success: true,
      statusCode: 201,
      message: `Address added to student ${studentId}. ID: ${address.id}`,
      data: address,
    };
  }

  @Patch(':addressId')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  async update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateStudentAddressDto,
  ) {
    const address = await this.addressService.update(studentId, addressId, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Address updated. ID: ${address.id}`,
      data: address,
    };
  }

  @Delete(':addressId')
  @RequirePermissions(PERMISSIONS.STUDENTS_DELETE)
  async remove(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    await this.addressService.remove(studentId, addressId);
    return {
      success: true,
      statusCode: 200,
      message: `Address removed. ID: ${addressId}`,
    };
  }
}
