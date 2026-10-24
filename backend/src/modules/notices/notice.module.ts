import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { DomainEventModule } from '~/modules/domain-events/domain-event.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { FileModule } from '~/modules/files/file.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { NotificationModule } from '~/modules/notifications/notification.module';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { SectionModule } from '~/modules/sections/section.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { StudentModule } from '~/modules/students/student.module';
import { TeachingModule } from '~/modules/teaching/teaching.module';
import { UserModule } from '~/modules/users/user.module';
import { CommunicationScheduler } from './communication.scheduler';
import { NoticeController } from './controllers/notice.controller';
import { PublicHomeController } from './controllers/public-home.controller';
import {
  NoticeReadRepository,
  NoticeRepository,
} from './repositories/notice.repositories';
import { AudienceService } from './services/audience.service';
import { EventDispatcherService } from './services/event-dispatcher.service';
import { NoticeService } from './services/notice.service';

/**
 * Notices and the automated notifications (PRD 6.13): the notice board
 * with audiences and read receipts, the public home page, and the
 * scheduler that publishes scheduled notices and turns domain events into
 * notifications.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization]),
    RbacModule,
    AccessScopeModule,
    UserModule,
    AcademicYearModule,
    SectionModule,
    TeachingModule,
    StudentModule,
    GuardianModule,
    EnrollmentModule,
    SettingsModule,
    FileModule,
    DomainEventModule,
    NotificationModule,
  ],
  controllers: [NoticeController, PublicHomeController],
  providers: [
    NoticeRepository,
    NoticeReadRepository,
    AudienceService,
    NoticeService,
    EventDispatcherService,
    CommunicationScheduler,
  ],
  exports: [NoticeService, AudienceService],
})
export class NoticeModule {}
