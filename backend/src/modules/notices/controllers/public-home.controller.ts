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
 * The school's public home page data (PRD 6.13 public notices, 6.24): name
 * and branding always (the sign-in pages use them); when `homePage.enabled`,
 * the rest (hero, about, principal's message, facts, highlights,
 * admission banner, contact, address and public notices) as
 * `profile.homePage` says. Read as the school (RLS applies) though the
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
      const page = profile.homePage;
      const brand = {
        slug: org.slug,
        name: display.name,
        nameBn: display.nameBn,
        logoUrl: display.logoUrl,
        colors: display.colors,
        enabled: page.enabled,
      };
      if (!page.enabled) return brand;
      const notices = page.showNotices
        ? await (await resolve(NoticeService)).publicNotices(page.noticeLimit)
        : [];
      const images = await settings.homePageImages();
      return {
        ...brand,
        tagline: page.tagline,
        taglineBn: page.taglineBn,
        heroImageUrl: images.hero,
        establishedYear: profile.establishedYear,
        about: page.about,
        aboutBn: page.aboutBn,
        principal:
          page.principalMessage || page.principalMessageBn
            ? {
                name: profile.principalName,
                photoUrl: images.principal,
                message: page.principalMessage,
                messageBn: page.principalMessageBn,
              }
            : null,
        facts: page.facts,
        highlights: page.highlights,
        admission: page.admission.open
          ? { note: page.admission.note, noteBn: page.admission.noteBn }
          : null,
        contact: page.showContact
          ? {
              phone: profile.phone,
              email: profile.email,
              website: profile.website,
            }
          : null,
        address: page.showAddress ? profile.address : null,
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
