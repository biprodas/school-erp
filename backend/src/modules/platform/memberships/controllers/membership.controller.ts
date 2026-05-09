import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { Roles } from '~/common/decorators/roles.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { RolesGuard } from '~/common/guards/roles.guard';
import { PlatformRole } from 'src/modules/platform/users/enums/platform-role.enum';
import { CreateMembershipDto } from '../dto/create-membership.dto';
import { UpdateMembershipRoleDto } from '../dto/update-membership-role.dto';
import { MembershipService } from '../services/membership.service';

@Controller('memberships')
@UseGuards(PlatformJwtAuthGuard)
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('tenant/:tenantId')
  async findByTenant(
    @RequestContext() ctx: RequestContextDto,
    @Param('tenantId') tenantId: string,
  ) {
    const memberships = await this.membershipService.findByTenantId(ctx, tenantId);
    return {
      success: true,
      statusCode: 200,
      message: `List of memberships`,
      data: memberships,
    }
  }

  @Get('user/:userId')
  async findByUser(
    @RequestContext() ctx: RequestContextDto,
    @Param('userId') userId: string,
  ) {
    const memberships = await this.membershipService.findByUserId(ctx, userId);
    return {
      success: true,
      statusCode: 200,
      message: `List of memberships`,
      data: memberships,
    }
  }

  @Get('me')
  async findMine(@RequestContext() ctx: RequestContextDto) {
    const memberships = await this.membershipService.findByUserId(ctx, ctx.user?.id ?? '');
    return {
      success: true,
      statusCode: 200,
      message: `List of memberships`,
      data: memberships,
    }
  }

  @Get(':id')
  async findOne(
    @RequestContext() ctx: RequestContextDto,
    @Param('id') id: string,
  ) {
    const membership = await this.membershipService.findById(ctx, id);
    return {
      success: true,
      statusCode: 200,
      message: `Membership found`,
      data: membership,
    }
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(PlatformRole.SUPER_ADMIN)
  async create(
    @RequestContext() ctx: RequestContextDto,
    @Body() dto: CreateMembershipDto,
  ) {
    const membership = await this.membershipService.create(ctx, dto);
    return {
      success: true,
      statusCode: 201,
      message: `Membership created successfully`,
      data: membership,
    }
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(PlatformRole.SUPER_ADMIN)
  async updateRole(
    @RequestContext() ctx: RequestContextDto,
    @Param('id') id: string,
    @Body() dto: UpdateMembershipRoleDto,
  ) {
    const membership = await this.membershipService.updateRole(ctx, id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Membership updated successfully`,
      data: membership,
    }
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(PlatformRole.SUPER_ADMIN)
  async remove(
    @RequestContext() ctx: RequestContextDto,
    @Param('id') id: string,
  ) {
    await this.membershipService.remove(ctx, id);
    return {
      success: true,
      statusCode: 200,
      message: `Membership removed successfully`,
    }
  }
}
