import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from './entities/membership.entity';
import { MembershipService } from './services/membership.service';
import { MembershipController } from './controllers/membership.controller';
import { OrganizationModule } from '~/modules/organizations/organization.module';
import { UserModule } from '~/modules/users/user.module';
import { AuthModule } from '~/modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Membership]),
    OrganizationModule,
    UserModule,
    AuthModule,
  ],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
