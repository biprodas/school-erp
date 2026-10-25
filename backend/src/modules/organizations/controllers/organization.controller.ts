import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReqContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { PlatformPermissionsGuard } from '~/common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '~/common/decorators/require-platform-permissions.decorator';
import { PLATFORM_PERMISSIONS } from '~/common/auth/platform-permissions';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { TransferOwnershipDto } from '../dto/transfer-ownership.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import {
  ChangePlanDto,
  ExtendTrialDto,
  FilterOrganizationDto,
  SetLimitsDto,
} from '../dto/platform-organization.dto';
import { OrganizationService } from '../services/organization.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Platform / Organizations')
@ApiBearerAuth('platform-jwt')
@Controller('organizations')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  /**
   * Staff with `organizations:read`: the school directory (filters,
   * paginated, with plan, district and active students). Others: the
   * schools they belong to.
   */
  @Get()
  @ResponseMessage('List of organizations')
  findAll(
    @ReqContext() ctx: RequestContextDto,
    @Query() filter: FilterOrganizationDto,
  ) {
    return this.organizationService.getAllOrganizations(ctx, filter);
  }

  @Get(':id')
  @ResponseMessage('Organization found')
  findOne(
    @ReqContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.organizationService.findByIdForUser(ctx, id);
  }

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE)
  @ResponseMessage('Organization created successfully')
  async create(
    @ReqContext() ctx: RequestContextDto,
    @Body() createOrganizationDto: CreateOrganizationDto,
  ) {
    const { organization, ownerActivation } =
      await this.organizationService.createOrganization(
        ctx,
        createOrganizationDto,
      );

    return { ...organization, activation: ownerActivation ?? null };
  }

  @Patch(':id')
  @ResponseMessage('Organization updated successfully')
  update(
    @ReqContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationService.updateOrganization(
      ctx,
      id,
      updateOrganizationDto,
    );
  }

  @Patch(':id/plan')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE)
  @ResponseMessage('Plan changed')
  changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.organizationService.changePlan(id, dto);
  }

  @Post(':id/trial/extend')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE)
  @ResponseMessage('Trial extended')
  extendTrial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendTrialDto,
  ) {
    return this.organizationService.extendTrial(id, dto);
  }

  /** Replaces the school's limit overrides (omitted keys follow the plan). */
  @Put(':id/limits')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE)
  @ResponseMessage('Limits updated')
  setLimits(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetLimitsDto) {
    return this.organizationService.setLimits(id, dto);
  }

  @Post(':id/transfer-ownership')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE)
  @ResponseMessage('Organization ownership transferred')
  async transferOwnership(
    @ReqContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    const { membership, ownerActivation } =
      await this.organizationService.transferOwnership(ctx, id, dto);

    return { ...membership, activation: ownerActivation ?? null };
  }

  /**
   * Emails the owner a new activation link. Staff who can manage schools
   * (and the owner) also get the token back; support only sends the email.
   */
  @Post(':id/owner/activation-link')
  @ResponseMessage('Owner activation link issued')
  reissueOwnerActivation(
    @ReqContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.organizationService.reissueOwnerActivation(ctx, id);
  }

  @Delete(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.ORGANIZATIONS_MANAGE)
  @ResponseMessage('Organization deleted successfully')
  async remove(
    @ReqContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.organizationService.deleteOrganization(ctx, id);
  }
}
