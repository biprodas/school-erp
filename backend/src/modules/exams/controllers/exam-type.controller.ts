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
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { CreateExamTypeDto, UpdateExamTypeDto } from '../dto/exam.dto';
import { ExamTypeService } from '../services/exam-type.service';

@ApiTags('Tenant / Exams')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('exam-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExamTypeController {
  constructor(private readonly types: ExamTypeService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EXAMS_READ)
  @ResponseMessage('Exam types')
  findAll() {
    return this.types.findAll();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXAMS_CREATE)
  @ResponseMessage('Exam type created')
  create(@Body() dto: CreateExamTypeDto) {
    return this.types.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EXAMS_UPDATE)
  @ResponseMessage('Exam type updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamTypeDto,
  ) {
    return this.types.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EXAMS_DELETE)
  @ResponseMessage('Exam type deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.types.remove(id);
  }
}
