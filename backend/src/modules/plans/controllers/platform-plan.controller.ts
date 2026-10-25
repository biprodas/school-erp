import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { PlatformPermissionsGuard } from '~/common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '~/common/decorators/require-platform-permissions.decorator';
import { PLATFORM_PERMISSIONS } from '~/common/auth/platform-permissions';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { Plan } from '../entities/plan.entity';
import { ADD_ON_MODULES, ALL_PLAN_MODULES } from '../plans.catalog';

/** The plan catalog, for assigning plans in the school directory. */
@ApiTags('Platform / Plans')
@ApiBearerAuth('platform-jwt')
@Controller('platform/plans')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@RequirePlatformPermissions(PLATFORM_PERMISSIONS.PLANS_READ)
export class PlatformPlanController {
  constructor(
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
  ) {}

  @Get()
  @ResponseMessage('List of plans')
  async findAll() {
    const plans = await this.plans.find({ order: { sortOrder: 'ASC' } });
    return {
      plans,
      modules: ALL_PLAN_MODULES,
      addOnModules: ADD_ON_MODULES,
    };
  }
}
