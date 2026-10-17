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
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { TransferOwnershipDto } from '../dto/transfer-ownership.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { OrganizationService } from '../services/organization.service';

@ApiTags('Platform / Organizations')
@ApiBearerAuth('platform-jwt')
@Controller('organizations')
@UseGuards(PlatformJwtAuthGuard)
export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  @Get()
  async findAll(@RequestContext() ctx: RequestContextDto) {
    const organizations =
      await this.organizationService.getAllOrganizations(ctx);

    return {
      success: true,
      statusCode: 200,
      message: `List of organizations`,
      data: organizations,
    };
  }

  @Get(':id')
  async findOne(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const organization = await this.organizationService.findByIdForUser(
      ctx,
      id,
    );

    return {
      success: true,
      statusCode: 200,
      message: `Organization found`,
      data: organization,
    };
  }

  @Post()
  async create(
    @RequestContext() ctx: RequestContextDto,
    @Body() createOrganizationDto: CreateOrganizationDto,
  ) {
    const { organization, ownerActivation } =
      await this.organizationService.createOrganization(
        ctx,
        createOrganizationDto,
      );

    return {
      success: true,
      statusCode: 201,
      message: `Organization created successfully`,
      data: { ...organization, activation: ownerActivation ?? null },
    };
  }

  @Patch(':id')
  async update(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    const organization = await this.organizationService.updateOrganization(
      ctx,
      id,
      updateOrganizationDto,
    );

    return {
      success: true,
      statusCode: 200,
      message: `Organization updated successfully`,
      data: organization,
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
      await this.organizationService.transferOwnership(ctx, id, dto);

    return {
      success: true,
      statusCode: 200,
      message: 'Organization ownership transferred',
      data: { ...membership, activation: ownerActivation ?? null },
    };
  }

  @Post(':id/owner/activation-link')
  async reissueOwnerActivation(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const activation = await this.organizationService.reissueOwnerActivation(
      ctx,
      id,
    );

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
    await this.organizationService.deleteOrganization(ctx, id);

    return {
      success: true,
      statusCode: 200,
      message: `Organization deleted successfully`,
    };
  }
}
