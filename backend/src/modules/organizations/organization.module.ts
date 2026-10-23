import { Module } from '@nestjs/common';
import * as dnsPromises from 'node:dns/promises';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationDomain } from './entities/organization-domain.entity';
import { OrganizationSlugHistory } from './entities/organization-slug-history.entity';
import { Plan } from '~/modules/plans/entities/plan.entity';
import { PlanModule } from '~/modules/plans/plan.module';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { UserModule } from '~/modules/users/user.module';
import { AuthModule } from '~/modules/auth/auth.module';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { OrganizationService } from './services/organization.service';
import { OrganizationController } from './controllers/organization.controller';
import { PublicOrganizationController } from './controllers/public-organization.controller';
import { PublicSlugController } from './controllers/public-slug.controller';
import { OrgSlugController } from './controllers/org-slug.controller';
import { SlugService } from './services/slug.service';
import { OrganizationDomainController } from './controllers/organization-domain.controller';
import { OrganizationDomainRepository } from './repositories/organization-domain.repository';
import { OrganizationDomainService } from './services/organization-domain.service';
import { DNS_RESOLVER, DomainDnsService } from './services/domain-dns.service';
import { DomainCheckScheduler } from './services/domain-check.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationDomain,
      OrganizationSlugHistory,
      Membership,
      Plan,
    ]),
    PlanModule,
    UserModule,
    RbacModule,
    SettingsModule,
    AuthModule,
  ],
  controllers: [
    OrganizationController,
    PublicOrganizationController,
    PublicSlugController,
    OrganizationDomainController,
    OrgSlugController,
  ],
  providers: [
    OrganizationService,
    SlugService,
    OrganizationDomainRepository,
    OrganizationDomainService,
    DomainDnsService,
    { provide: DNS_RESOLVER, useValue: dnsPromises },
    DomainCheckScheduler,
  ],
  exports: [OrganizationService, SlugService],
})
export class OrganizationModule {}
