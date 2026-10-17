import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrganizationStatus } from '../enums/organization-status.enum';
import { OrganizationService } from '../services/organization.service';

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
  async resolve(@Query('host') host?: string) {
    if (!host) {
      throw new BadRequestException('host query parameter is required');
    }

    const organization = await this.organizationService.findByDomain(host);
    if (!organization || organization.status !== OrganizationStatus.ACTIVE) {
      throw new NotFoundException('No active organization for this host');
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Organization resolved',
      data: {
        slug: organization.slug,
        name: organization.name,
        status: organization.status,
      },
    };
  }

  @Get('by-slug')
  async bySlug(@Query('slug') slug?: string) {
    if (!slug) {
      throw new BadRequestException('slug query parameter is required');
    }

    const organization = await this.organizationService.findBySlug(slug);
    if (!organization || organization.status !== OrganizationStatus.ACTIVE) {
      throw new NotFoundException('No active organization for this slug');
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Organization resolved',
      data: {
        slug: organization.slug,
        name: organization.name,
        status: organization.status,
      },
    };
  }
}
