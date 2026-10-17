import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { PERMISSIONS } from '../../rbac/permissions.catalog';
import { RequirePermissions } from '../../rbac/require-permissions.decorator';
import { CreateStudentDto } from '../dto/create-student.dto';
import { FilterStudentDto } from '../dto/filter-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import { StudentService } from '../services/student.service';

@ApiTags('Tenant / Students')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('students')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  async findAll(@Query() filter: FilterStudentDto) {
    const students = await this.studentService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of students',
      data: students,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  async create(@Body() dto: CreateStudentDto) {
    const student = await this.studentService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Student created. ID: ${student.id}`,
      data: student,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const student = await this.studentService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Student found. ID: ${student.id}`,
      data: student,
    };
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    const student = await this.studentService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Student updated. ID: ${student.id}`,
      data: student,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.studentService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Student deleted. ID: ${id}`,
    };
  }
}
