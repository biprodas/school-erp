import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { Plan } from './entities/plan.entity';
import { PlatformPlanController } from './controllers/platform-plan.controller';
import { EntitlementService } from './services/entitlement.service';
import { PlanModuleGuard } from './guards/plan-module.guard';
import { PlanSeeder } from './services/plan.seeder';

/**
 * Plans and entitlements (PRD 3.3, 6.1). Feature modules import it for
 * `EntitlementService` (limits) and `@RequireModule` (its guard).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Plan, Organization])],
  controllers: [PlatformPlanController],
  providers: [EntitlementService, PlanModuleGuard, PlanSeeder],
  exports: [EntitlementService, PlanModuleGuard],
})
export class PlanModule {}
