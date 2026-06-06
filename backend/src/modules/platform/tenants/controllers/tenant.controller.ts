import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { PlatformAdminGuard } from '~/common/guards/platform-admin.guard';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { TransferOwnershipDto } from '../dto/transfer-ownership.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { TenantService } from '../services/tenant.service';

@ApiTags('Platform / Tenants')
@ApiBearerAuth('platform-jwt')
@Controller('tenants')
@UseGuards(PlatformJwtAuthGuard)
export class TenantController {
  constructor(private tenantService: TenantService) {}

  @Get()
  async findAll(@RequestContext() ctx: RequestContextDto) {
    const tenants = await this.tenantService.getAllTenants(ctx);

    return {
      success: true,
      statusCode: 200,
      message: `List of tenants`,
      data: tenants,
    };
  }

  @Get(':id')
  async findOne(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenant = await this.tenantService.findByIdForUser(ctx, id);

    return {
      success: true,
      statusCode: 200,
      message: `Tenant found`,
      data: tenant,
    };
  }

  @Post()
  async create(
    @RequestContext() ctx: RequestContextDto,
    @Body() createTenantDto: CreateTenantDto,
  ) {
    const { tenant, ownerActivation } = await this.tenantService.createTenant(
      ctx,
      createTenantDto,
    );

    return {
      success: true,
      statusCode: 201,
      message: `Tenant created successfully`,
      data: { ...tenant, activation: ownerActivation ?? null },
    };
  }

  @Patch(':id')
  async update(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    const tenant = await this.tenantService.updateTenant(
      ctx,
      id,
      updateTenantDto,
    );

    return {
      success: true,
      statusCode: 200,
      message: `Tenant updated successfully`,
      data: tenant,
    };
  }

  @Post(':id/transfer-ownership')
  @UseGuards(PlatformAdminGuard)
  async transferOwnership(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    const { membership, ownerActivation } =
      await this.tenantService.transferOwnership(ctx, id, dto);

    return {
      success: true,
      statusCode: 200,
      message: 'Tenant ownership transferred',
      data: { ...membership, activation: ownerActivation ?? null },
    };
  }

  @Post(':id/resume-activation')
  async resumeOwnerActivation(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const activation = await this.tenantService.resumeOwnerActivation(ctx, id);

    return {
      success: true,
      statusCode: 200,
      message: 'Owner activation link issued',
      data: { activation },
    };
  }

  @Post(':id/complete-onboarding')
  async completeOnboarding(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.tenantService.completeOnboarding(ctx, id);

    return {
      success: true,
      statusCode: 200,
      message: 'Onboarding completed',
      data: result,
    };
  }

  @Post(':id/owner/activation-link')
  @UseGuards(PlatformAdminGuard)
  async reissueOwnerActivation(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const activation = await this.tenantService.reissueOwnerActivation(ctx, id);

    return {
      success: true,
      statusCode: 200,
      message: 'Owner activation link issued',
      data: activation,
    };
  }

  @Delete(':id')
  @UseGuards(PlatformAdminGuard)
  async remove(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.tenantService.deleteTenant(ctx, id);

    return {
      success: true,
      statusCode: 200,
      message: `Tenant deleted successfully`,
    };
  }
}
