import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.catalog';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { FilterPromotionDto } from './dto/filter-promotion.dto';
import { PromotionService } from './promotion.service';

@ApiTags('Tenant / Promotions')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('promotions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROMOTIONS_READ)
  async findAll(@Query() filter: FilterPromotionDto) {
    const items = await this.promotionService.findFiltered(filter);
    return {
      success: true,
      statusCode: 200,
      message: 'List of promotions',
      data: items,
    };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROMOTIONS_CREATE)
  async create(@Body() dto: CreatePromotionDto) {
    const item = await this.promotionService.create(dto);
    return {
      success: true,
      statusCode: 201,
      message: `Promotion recorded. ID: ${item.id}`,
      data: item,
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.promotionService.findById(id);
    return {
      success: true,
      statusCode: 200,
      message: `Promotion found. ID: ${item.id}`,
      data: item,
    };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.promotionService.remove(id);
    return {
      success: true,
      statusCode: 200,
      message: `Promotion deleted. ID: ${id}`,
    };
  }
}
