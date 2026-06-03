import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantStatus } from '../enums/tenant-status.enum';
import { TenantService } from '../services/tenant.service';

/**
 * Public, unauthenticated tenant discovery for the frontend.
 *
 * Used to resolve a custom/vanity domain (e.g. `app.acmeschool.com`) to its
 * tenant slug BEFORE login, since such a host can't be parsed. Returns only
 * safe public fields and only for ACTIVE tenants. This route is excluded from
 * the tenant middleware (see `app.module.ts`).
 */
@ApiTags('Public / Tenants')
@Controller('public/tenants')
export class PublicTenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('resolve')
  async resolve(@Query('host') host?: string) {
    if (!host) {
      throw new BadRequestException('host query parameter is required');
    }

    const tenant = await this.tenantService.findByDomain(host);
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new NotFoundException('No active tenant for this host');
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Tenant resolved',
      data: {
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
      },
    };
  }

  @Get('by-slug')
  async bySlug(@Query('slug') slug?: string) {
    if (!slug) {
      throw new BadRequestException('slug query parameter is required');
    }

    const tenant = await this.tenantService.findBySlug(slug);
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new NotFoundException('No active tenant for this slug');
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Tenant resolved',
      data: {
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
      },
    };
  }
}
