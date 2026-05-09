import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from './entities/membership.entity';
import { MembershipService } from './services/membership.service';
import { MembershipController } from './controllers/membership.controller';
import { TenantModule } from 'src/modules/platform/tenants/tenant.module';
import { UserModule } from 'src/modules/platform/users/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Membership]), TenantModule, UserModule],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
