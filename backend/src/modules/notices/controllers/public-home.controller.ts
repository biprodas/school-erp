import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { TenantJobRunner } from '~/tenancy/tenant-job.runner';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { isOperationalOrganization } from '~/modules/organizations/enums/organization-status.enum';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { NoticeService } from '../services/notice.service';

/**
 * The school's public home page data (PRD 6.13 public notices): name,
 * branding and public notices. Read as the school (RLS applies) though the
 * route itself is outside the tenant middleware.
 */
@ApiTags('Public')
@Controller('public/organizations')
export class PublicHomeController {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    private readonly runner: TenantJobRunner,
  ) {}

  @Get(':slug/home')
  @ResponseMessage('School home')
  async home(@Param('slug') slug: string) {
    const org = await this.organizations.findOne({ where: { slug } });
    if (!org || !isOperationalOrganization(org.status)) {
      throw new NotFoundException('School not found');
    }
    return this.runner.run(org.id, async (resolve) => {
      const settings = await resolve(SettingsService);
      const display = await settings.getDisplay();
      const profile = await settings.getSection('profile');
      const notices = await (await resolve(NoticeService)).publicNotices();
      return {
        slug: org.slug,
        name: display.name,
        nameBn: display.nameBn,
        logoUrl: display.logoUrl,
        colors: display.colors,
        contact: {
          phone: profile.phone,
          email: profile.email,
          website: profile.website,
          address: profile.address,
        },
        notices: notices.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          pinned: n.pinned,
          publishAt: n.publishAt,
        })),
      };
    });
  }
}
