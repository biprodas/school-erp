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
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Platform / Organizations')
@ApiBearerAuth('platform-jwt')
@Controller('organizations')
@UseGuards(PlatformJwtAuthGuard)
export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  @Get()
  @ResponseMessage('List of organizations')
  findAll(@RequestContext() ctx: RequestContextDto) {
    return this.organizationService.getAllOrganizations(ctx);
  }

  @Get(':id')
  @ResponseMessage('Organization found')
  findOne(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.organizationService.findByIdForUser(ctx, id);
  }

  @Post()
  @UseGuards(PlatformAdminGuard)
  @ResponseMessage('Organization created successfully')
  async create(
    @RequestContext() ctx: RequestContextDto,
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
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationService.updateOrganization(
      ctx,
      id,
      updateOrganizationDto,
    );
  }

  @Post(':id/transfer-ownership')
  @UseGuards(PlatformAdminGuard)
  @ResponseMessage('Organization ownership transferred')
  async transferOwnership(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    const { membership, ownerActivation } =
      await this.organizationService.transferOwnership(ctx, id, dto);

    return { ...membership, activation: ownerActivation ?? null };
  }

  @Post(':id/owner/activation-link')
  @ResponseMessage('Owner activation link issued')
  reissueOwnerActivation(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.organizationService.reissueOwnerActivation(ctx, id);
  }

  @Delete(':id')
  @UseGuards(PlatformAdminGuard)
  @ResponseMessage('Organization deleted successfully')
  async remove(
    @RequestContext() ctx: RequestContextDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.organizationService.deleteOrganization(ctx, id);
  }
}
