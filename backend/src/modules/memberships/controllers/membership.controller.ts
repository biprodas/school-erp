import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequestContext } from '~/common/decorators/request-context.decorator';
import { RequestContextDto } from '~/common/dto/request-context.dto';
import { PlatformJwtAuthGuard } from '~/common/guards/platform-jwt-auth.guard';
import { CreateMembershipDto } from '../dto/create-membership.dto';
import { UpdateMembershipRoleDto } from '../dto/update-membership-role.dto';
import { MembershipService } from '../services/membership.service';
import { FilterMembershipDto } from '../dto/filter-membership.dto';
import { ResponseMessage } from '~/common/decorators/response.decorators';

@ApiTags('Platform / Memberships')
@ApiBearerAuth('platform-jwt')
@Controller('memberships')
@UseGuards(PlatformJwtAuthGuard)
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()
  @ResponseMessage('List of memberships')
  findAll(
    @RequestContext() ctx: RequestContextDto,
    @Query() dto: FilterMembershipDto,
  ) {
    return this.membershipService.findAll(ctx, dto);
  }

  @Get('organization/:orgId')
  @ResponseMessage('List of memberships')
  findByOrganization(
    @RequestContext() ctx: RequestContextDto,
    @Param('orgId') orgId: string,
  ) {
    return this.membershipService.findByOrgId(ctx, orgId);
  }

  @Get('user/:userId')
  @ResponseMessage('List of memberships')
  findByUser(
    @RequestContext() ctx: RequestContextDto,
    @Param('userId') userId: string,
  ) {
    return this.membershipService.findByUserId(ctx, userId);
  }

  @Get('me')
  @ResponseMessage('List of memberships')
  findMine(@RequestContext() ctx: RequestContextDto) {
    return this.membershipService.findByUserId(ctx, ctx.user?.id ?? '');
  }

  @Get(':id')
  @ResponseMessage('Membership found')
  findOne(@RequestContext() ctx: RequestContextDto, @Param('id') id: string) {
    return this.membershipService.findById(ctx, id);
  }

  @Post()
  @ResponseMessage('Membership created successfully')
  async create(
    @RequestContext() ctx: RequestContextDto,
    @Body() dto: CreateMembershipDto,
  ) {
    const { membership, ownerActivation } = await this.membershipService.create(
      ctx,
      dto,
    );
    return { ...membership, activation: ownerActivation ?? null };
  }

  @Patch(':id')
  @ResponseMessage('Membership updated successfully')
  updateRole(
    @RequestContext() ctx: RequestContextDto,
    @Param('id') id: string,
    @Body() dto: UpdateMembershipRoleDto,
  ) {
    return this.membershipService.updateRole(ctx, id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Membership removed successfully')
  async remove(
    @RequestContext() ctx: RequestContextDto,
    @Param('id') id: string,
  ) {
    await this.membershipService.remove(ctx, id);
  }
}
