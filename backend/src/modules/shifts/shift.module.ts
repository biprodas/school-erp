import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { ShiftController } from './shift.controller';
import { ShiftRepository } from './shift.repository';
import { ShiftService } from './shift.service';

@Module({
  imports: [RbacModule],
  controllers: [ShiftController],
  providers: [ShiftRepository, ShiftService],
  exports: [ShiftService],
})
export class ShiftModule {}
