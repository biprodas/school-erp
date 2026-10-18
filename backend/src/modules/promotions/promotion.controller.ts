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
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { FilterPromotionDto } from './dto/filter-promotion.dto';
import { PromotionService } from './promotion.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

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
  @ResponseMessage('List of promotions')
  findAll(@Query() filter: FilterPromotionDto) {
    return this.promotionService.findFiltered(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROMOTIONS_CREATE)
  @ResponseMessage('Promotion recorded')
  create(@Body() dto: CreatePromotionDto) {
    return this.promotionService.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_READ)
  @ResponseMessage('Promotion found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionService.findById(id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_DELETE)
  @ResponseMessage('Promotion deleted')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.promotionService.remove(id);
  }
}
