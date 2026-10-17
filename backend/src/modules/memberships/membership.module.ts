import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from './entities/membership.entity';
import { MembershipService } from './services/membership.service';
import { MembershipController } from './controllers/membership.controller';
import { OrganizationModule } from 'src/modules/platform/organizations/organization.module';
import { UserModule } from 'src/modules/platform/users/user.module';
import { RbacModule } from '~/tenanted/rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Membership]),
    OrganizationModule,
    UserModule,
    RbacModule,
  ],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
