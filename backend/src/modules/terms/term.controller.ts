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
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreateTermDto } from './dto/create-term.dto';
import { FilterTermDto } from './dto/filter-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { TermService } from './term.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Tenant / Terms')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('terms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TermController {
  constructor(private readonly termService: TermService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TERMS_READ)
  @ResponseMessage('List of terms')
  findAll(@Query() filter: FilterTermDto) {
    return this.termService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TERMS_CREATE)
  @ResponseMessage('Term created')
  create(@Body() dto: CreateTermDto) {
    return this.termService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TERMS_READ)
  @ResponseMessage('Term found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.termService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TERMS_UPDATE)
  @ResponseMessage('Term updated')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTermDto) {
    return this.termService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TERMS_DELETE)
  @ResponseMessage('Term deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.termService.remove(id);
  }
}
