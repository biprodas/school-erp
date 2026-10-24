import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { PdfService } from '~/shared/pdf/pdf.service';
import { FileService } from '~/modules/files/file.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { SettingsService } from '~/modules/settings/services/settings.service';
import {
  CREDENTIAL_SLIPS_JOB,
  CredentialSlipService,
  type CredentialSlipsJobData,
} from './credential-slip.service';

/**
 * The slips PDF for a section, eight to an A4 page for cutting. It holds
 * passwords, so the link goes only to the job's creator (and school
 * admins), like every job download.
 */
@Injectable()
export class CredentialSlipJob {
  constructor(
    private readonly tracker: JobTracker,
    private readonly pdf: PdfService,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  @JobHandler(QUEUES.pdf, CREDENTIAL_SLIPS_JOB)
  handle(payload: JobPayload<CredentialSlipsJobData>, context: JobContext) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const slips = await resolve(CredentialSlipService);
      const settings = await resolve(SettingsService);
      const files = await resolve(FileService);
      const org = await this.organizations.findOneOrFail({
        where: { id: payload.orgId! },
      });
      const school = await settings.getDisplay();
      const built = await slips.build(payload.data, org.slug);
      const buffer = await this.pdf.render(
        'credential-slips/slips',
        {
          schoolName: school.name,
          schoolNameBn: school.nameBn,
          className: built.section.schoolClass?.name ?? '',
          sectionName: built.section.name,
          signInUrl: built.signInUrl,
          slips: built.slips,
        },
        { paper: 'A4' },
      );
      const stored = await files.storeGenerated({
        buffer,
        originalName: `sign-in-slips-${built.section.schoolClass?.name ?? ''}-${built.section.name}.pdf`,
      });
      return {
        fileId: stored.id,
        result: { issued: built.slips.length, skipped: built.skipped },
      };
    });
  }
}
