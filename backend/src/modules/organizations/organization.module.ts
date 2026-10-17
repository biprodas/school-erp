import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { Membership } from 'src/modules/memberships/entities/membership.entity';
import { UserModule } from 'src/modules/users/user.module';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { OrganizationService } from './services/organization.service';
import { OrganizationController } from './controllers/organization.controller';
import { PublicOrganizationController } from './controllers/public-organization.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Membership]),
    UserModule,
    RbacModule,
  ],
  controllers: [OrganizationController, PublicOrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
