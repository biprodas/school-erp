import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { TenantUserModule } from '../users/user.module';
import { StakeholderController } from './stakeholder.controller';
import { StakeholderRepository } from './stakeholder.repository';
import { StakeholderService } from './stakeholder.service';

@Module({
  imports: [RbacModule, TenantUserModule],
  controllers: [StakeholderController],
  providers: [StakeholderRepository, StakeholderService],
  exports: [StakeholderService],
})
export class StakeholderModule {}
