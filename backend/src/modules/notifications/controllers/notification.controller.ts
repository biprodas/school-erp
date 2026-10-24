import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '~/common/auth/auth-user';
import { CurrentUser } from '~/common/decorators/current-user.decorator';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  FilterDeliveryLogDto,
  FilterNotificationDto,
  SaveTemplateDto,
} from '../dto/notification.dto';
import { NotificationService } from '../services/notification.service';

/** The signed-in user's in-app notifications (staff and portal alike). */
@ApiTags('Tenant / Notifications')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ResponseMessage('Notifications')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() filter: FilterNotificationDto,
  ) {
    return this.notifications.findMine(user.userId, filter);
  }

  @Get('unread-count')
  @ResponseMessage('Unread notifications')
  unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.userId);
  }

  @Post('read-all')
  @HttpCode(200)
  @ResponseMessage('All read')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.userId);
  }

  @Post(':id/read')
  @HttpCode(200)
  @ResponseMessage('Read')
  async read(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notifications.markRead(user.userId, id);
  }
}

/** Notification texts and the communication log. */
@ApiTags('Tenant / Notifications')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommunicationController {
  constructor(private readonly notifications: NotificationService) {}

  /** Every key, channel and language, the school's wording or the default. */
  @Get('notification-templates')
  @RequirePermissions(PERMISSIONS.COMMUNICATION_MANAGE)
  @ResponseMessage('Notification templates')
  templates() {
    return this.notifications.templates();
  }

  @Put('notification-templates')
  @RequirePermissions(PERMISSIONS.COMMUNICATION_MANAGE)
  @ResponseMessage('Template saved')
  save(@Body() dto: SaveTemplateDto) {
    return this.notifications.saveTemplate(dto);
  }

  /** Back to the default text. */
  @Delete('notification-templates/:id')
  @RequirePermissions(PERMISSIONS.COMMUNICATION_MANAGE)
  @ResponseMessage('Template reset')
  async reset(@Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.resetTemplate(id);
  }

  /** What was sent to whom, when, on which channel, and its status. */
  @Get('communication-log')
  @RequirePermissions(PERMISSIONS.COMMUNICATION_READ)
  @ResponseMessage('Communication log')
  log(@Query() filter: FilterDeliveryLogDto) {
    return this.notifications.log(filter);
  }
}
