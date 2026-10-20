import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { isOperationalOrganization } from '../enums/organization-status.enum';
import { OrganizationService } from '../services/organization.service';
import { ResponseMessage } from '~/common/decorators/response.decorators';

/**
 * Public, unauthenticated organization discovery for the frontend.
 *
 * Used to resolve a custom/vanity domain (e.g. `app.acmeschool.com`) to its
 * tenant slug BEFORE login, since such a host can't be parsed. Returns only
 * safe public fields and only for ACTIVE organizations. This route is excluded from
 * the tenant middleware (see `app.module.ts`).
 */
@ApiTags('Public / Organizations')
@Controller('public/organizations')
export class PublicOrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('resolve')
  @ResponseMessage('Organization resolved')
  async resolve(@Query('host') host?: string) {
    if (!host) {
      throw new BadRequestException('host query parameter is required');
    }

    const organization = await this.organizationService.findByDomain(host);
    if (!organization || !isOperationalOrganization(organization.status)) {
      throw new NotFoundException('No active organization for this host');
    }

    return {
      slug: organization.slug,
      name: organization.name,
      status: organization.status,
    };
  }

  /**
   * On-demand TLS "ask" endpoint (Caddy `on_demand_tls.ask`): 200 only for a
   * verified or active custom domain of an active school, so certificates are
   * never issued for arbitrary hostnames pointed at us.
   */
  @Get('tls-check')
  @ResponseMessage('Domain allowed')
  async tlsCheck(@Query('domain') domain?: string) {
    if (!domain) {
      throw new BadRequestException('domain query parameter is required');
    }
    const organization = await this.organizationService.findByDomain(domain);
    if (!organization || !isOperationalOrganization(organization.status)) {
      throw new NotFoundException('Unknown domain');
    }
    return { allowed: true };
  }

  @Get('by-slug')
  @ResponseMessage('Organization resolved')
  async bySlug(@Query('slug') slug?: string) {
    if (!slug) {
      throw new BadRequestException('slug query parameter is required');
    }

    const organization = await this.organizationService.findBySlug(slug);
    if (!organization || !isOperationalOrganization(organization.status)) {
      throw new NotFoundException('No active organization for this slug');
    }

    return {
      slug: organization.slug,
      name: organization.name,
      status: organization.status,
    };
  }
}
