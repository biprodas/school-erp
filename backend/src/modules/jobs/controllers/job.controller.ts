import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { JobService } from '../services/job.service';

@ApiTags('Tenant / Jobs')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobController {
  constructor(private readonly jobService: JobService) {}

  /**
   * Status of a background job. Only the user who started it, or a school
   * admin, can read it; anyone else gets 404. A job that produced a file
   * (export, PDFs) carries a short-lived `downloadUrl`.
   */
  @Get(':id')
  @ResponseMessage('Job status')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobService.viewForCurrentUser(id);
  }
}
