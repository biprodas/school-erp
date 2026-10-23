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
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { CreatePromotionBatchDto } from '../dto/create-promotion-batch.dto';
import { FilterPromotionBatchDto } from '../dto/filter-promotion-batch.dto';
import { UpdatePromotionItemDto } from '../dto/update-promotion-item.dto';
import { PromotionService } from '../services/promotion.service';

/** Bulk promotion by class (PRD 6.6): draft, preview, commit, rollback. */
@ApiTags('Tenant / Promotions')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('promotions/batches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PromotionController {
  constructor(private readonly promotions: PromotionService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROMOTIONS_READ)
  @ResponseMessage('Promotion batches')
  findAll(@Query() filter: FilterPromotionBatchDto) {
    return this.promotions.findFiltered(filter);
  }

  /** Builds the draft and returns the preview. */
  @Post()
  @RequirePermissions(PERMISSIONS.PROMOTIONS_CREATE)
  @ResponseMessage('Promotion draft built')
  create(@Body() dto: CreatePromotionBatchDto) {
    return this.promotions.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_READ)
  @ResponseMessage('Promotion preview')
  preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.preview(id);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_CREATE)
  @ResponseMessage('Promotion item updated')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePromotionItemDto,
  ) {
    return this.promotions.updateItem(id, itemId, dto);
  }

  /** Queues the commit; poll `GET /jobs/:id`. */
  @Post(':id/commit')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.PROMOTIONS_COMMIT)
  @ResponseMessage('Promotion commit started')
  commit(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.startCommit(id);
  }

  /** Within 24 hours of the commit, while nothing uses the new rows. */
  @Post(':id/rollback')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_COMMIT)
  @ResponseMessage('Promotion rolled back')
  rollback(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.rollback(id);
  }

  /** Discards a draft. */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PROMOTIONS_DELETE)
  @ResponseMessage('Promotion draft discarded')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.promotions.remove(id);
  }
}
