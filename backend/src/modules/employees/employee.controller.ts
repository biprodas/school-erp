import { Throttle } from '@nestjs/throttler';
import { UPLOAD_THROTTLE } from '~/common/throttling/throttle.constants';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import { FileUpload } from '~/modules/files/file-upload.interceptor';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { FilterEmployeeDto } from './dto/filter-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { InviteEmployeeDto } from './dto/invite-employee.dto';
import { EmployeeService } from './employee.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Employees')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_READ)
  @ResponseMessage('List of employees')
  findAll(@Query() filter: FilterEmployeeDto) {
    return this.employeeService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_CREATE)
  @ResponseMessage('Employee created')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeeService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_READ)
  @ResponseMessage('Employee found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.findOneView(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @ResponseMessage('Employee updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(id, dto);
  }

  @Post(':id/photo')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileUpload('employee_photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ResponseMessage('Photo updated')
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        message: 'Attach the image as the multipart field "file"',
        code: 'FILE_REQUIRED',
      });
    }
    return this.employeeService.setPhoto(id, {
      buffer: file.buffer,
      originalName: file.originalname,
    });
  }

  /**
   * Gives the employee a login: activation link by email, or a one-time
   * slip password for phone-only staff. The role defaults to the
   * designation's.
   */
  @Post(':id/invite')
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  @ResponseMessage('Employee invited')
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteEmployeeDto,
  ) {
    return this.employeeService.invite(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_DELETE)
  @ResponseMessage('Employee deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.employeeService.remove(id);
  }
}
