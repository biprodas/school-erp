import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppHosts } from '~/shared/hosts/app-hosts';
import { MailService } from '~/shared/mail/mail.service';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { TenantJobRunner } from '~/tenancy/tenant-job.runner';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrgSettingsReader } from '~/modules/settings/services/org-settings.reader';
import { DeliveryLogRepository } from './repositories/notification.repositories';
import { EMAIL_DELIVERY_JOB } from './services/notification.service';

/**
 * Sends one queued notification email and records the outcome on its
 * delivery log. Failures retry with backoff (the queue's attempts); the
 * last failure marks the log `failed` with the error.
 */
@Injectable()
export class EmailDeliveryJob {
  constructor(
    private readonly runner: TenantJobRunner,
    private readonly mail: MailService,
    private readonly hosts: AppHosts,
    private readonly settings: OrgSettingsReader,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  @JobHandler(QUEUES.notifications, EMAIL_DELIVERY_JOB)
  async handle(
    payload: JobPayload<{ deliveryLogId: string }>,
    context: JobContext,
  ) {
    const org = await this.organizations.findOne({
      where: { id: payload.orgId! },
    });
    if (!org) return;
    // The text is already in the school's language; the layout follows it.
    const locale = (await this.settings.get(org.id)).locale.language;
    await this.runner.run(org.id, async (resolve) => {
      const logs = await resolve(DeliveryLogRepository);
      const log = await logs.findById(payload.data.deliveryLogId);
      if (!log || log.status === 'sent') return;
      const link = log.link
        ? this.hosts.url(this.hosts.schoolHost(org.slug), log.link)
        : null;
      try {
        const messageId = await this.mail.deliverNotification(
          log.recipient,
          log.subject,
          log.body ?? '',
          { link, schoolName: org.name, locale },
        );
        await logs.updateFields(log.id, {
          status: 'sent',
          providerMessageId: messageId,
          attempts: context.attempt,
          error: null,
          sentAt: new Date(),
        });
      } catch (err) {
        const last = context.attempt >= context.attempts;
        await logs.updateFields(log.id, {
          status: last ? 'failed' : 'queued',
          attempts: context.attempt,
          error: String((err as Error).message ?? err).slice(0, 1000),
        });
        if (!last) throw err;
      }
    });
  }
}
