import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { ClassModule } from '~/modules/classes/class.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { HolidayController } from './holiday.controller';
import { HolidayRepository } from './holiday.repository';
import { HolidayService } from './holiday.service';

@Module({
  imports: [RbacModule, ClassModule, SettingsModule],
  controllers: [HolidayController],
  providers: [HolidayRepository, HolidayService],
  exports: [HolidayService],
})
export class HolidayModule {}
