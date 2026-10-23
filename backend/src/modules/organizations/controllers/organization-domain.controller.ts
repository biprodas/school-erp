import { RequireModule } from '~/modules/plans/decorators/require-module.decorator';
import { PLAN_MODULES } from '~/modules/plans/plans.catalog';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { seconds, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { AddDomainDto } from '../dto/add-domain.dto';
import { OrganizationDomainService } from '../services/organization-domain.service';

/** The school's custom domains (Settings → Domain). */
@ApiTags('Tenant / Domains')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('domains')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationDomainController {
  constructor(private readonly domainService: OrganizationDomainService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DOMAINS_READ)
  @ResponseMessage('List of domains')
  findAll() {
    return this.domainService.list();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DOMAINS_MANAGE)
  @RequireModule(PLAN_MODULES.CUSTOM_DOMAIN)
  @ResponseMessage('Domain added. Create the DNS records, then verify.')
  add(@Body() dto: AddDomainDto) {
    return this.domainService.add(dto);
  }

  /** Runs the DNS check now (each call does live lookups, so it's limited). */
  @Post(':id/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @RequirePermissions(PERMISSIONS.DOMAINS_MANAGE)
  @RequireModule(PLAN_MODULES.CUSTOM_DOMAIN)
  @ResponseMessage('Domain checked')
  verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.domainService.verify(id);
  }

  @Post(':id/primary')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.DOMAINS_MANAGE)
  @RequireModule(PLAN_MODULES.CUSTOM_DOMAIN)
  @ResponseMessage('Primary domain set')
  setPrimary(@Param('id', ParseUUIDPipe) id: string) {
    return this.domainService.setPrimary(id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOMAINS_MANAGE)
  @ResponseMessage('Domain removed')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.domainService.remove(id);
  }
}
