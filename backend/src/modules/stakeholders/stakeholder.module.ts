import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { UserModule } from '~/modules/users/user.module';
import { StakeholderController } from './stakeholder.controller';
import { StakeholderRepository } from './stakeholder.repository';
import { StakeholderService } from './stakeholder.service';

@Module({
  imports: [RbacModule, UserModule],
  controllers: [StakeholderController],
  providers: [StakeholderRepository, StakeholderService],
  exports: [StakeholderService],
})
export class StakeholderModule {}
