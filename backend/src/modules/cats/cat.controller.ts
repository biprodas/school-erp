import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { CatService } from './cat.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import { FilterCatDto } from './dto/filter-cat.dto';

@ApiTags('Tenant / Cats')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('cats')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CatController {
  constructor(private readonly catService: CatService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CATS_CREATE)
  create(@Body() dto: CreateCatDto) {
    return this.catService.create(dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CATS_READ)
  findAll(@Query() filterCatDto: FilterCatDto) {
    return this.catService.findAll(filterCatDto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATS_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.catService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATS_UPDATE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCatDto) {
    return this.catService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CATS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.catService.remove(id);
  }
}
