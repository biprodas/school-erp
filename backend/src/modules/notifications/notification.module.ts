import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { SettingsModule } from '~/modules/settings/settings.module';
import { UserModule } from '~/modules/users/user.module';
import {
  CommunicationController,
  NotificationController,
} from './controllers/notification.controller';
import { EmailDeliveryJob } from './email-delivery.job';
import {
  DeliveryLogRepository,
  NotificationRepository,
  NotificationTemplateRepository,
} from './repositories/notification.repositories';
import { NotificationService } from './services/notification.service';

/**
 * Notifications (PRD 6.13 Phase 1a): in-app rows, emails through a retried
 * job, per-school templates and the communication log.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization]),
    RbacModule,
    UserModule,
    SettingsModule,
  ],
  controllers: [NotificationController, CommunicationController],
  providers: [
    NotificationRepository,
    NotificationTemplateRepository,
    DeliveryLogRepository,
    NotificationService,
    EmailDeliveryJob,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
