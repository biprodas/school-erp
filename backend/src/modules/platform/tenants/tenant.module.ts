import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { Membership } from 'src/modules/platform/memberships/entities/membership.entity';
import { TenantService } from './services/tenant.service';
import { TenantController } from './controllers/tenant.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Membership])],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
