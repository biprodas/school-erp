import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Between, FindOptionsWhere, IsNull } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { JobQueue, QUEUES } from '~/shared/queue';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import type { NotificationEvent } from '~/modules/settings/settings.types';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import {
  FilterDeliveryLogDto,
  FilterNotificationDto,
  SaveTemplateDto,
} from '../dto/notification.dto';
import type {
  DeliveryLog,
  Notification,
  NotificationTemplate,
} from '../entities/notification.entity';
import {
  DEFAULT_TEMPLATES,
  render,
  type TemplateChannel,
  type TemplateLocale,
  type TemplateText,
} from '../notification-templates';
import {
  DeliveryLogRepository,
  NotificationRepository,
  NotificationTemplateRepository,
} from '../repositories/notification.repositories';

export const EMAIL_DELIVERY_JOB = 'deliver-email';

export type TemplateVars = Record<string, string | number>;

export interface NotifyInput {
  userIds: string[];
  key: NotificationEvent;
  /** Shared variables, or per recipient. */
  vars: TemplateVars | ((userId: string) => TemplateVars);
  link?: string | null;
  data?: Record<string, unknown>;
}

/**
 * Notifications (PRD 6.13 Phase 1a): one call per event writes the in-app
 * rows and queues the emails, as the school's settings allow for that
 * event (`notifications.events`). Texts come from the school's templates,
 * else the code defaults, in the school's language. Every message is
 * logged in `delivery_logs` (the communication log); emails are sent by a
 * retried job. SMS and push plug in here in Phase 1b.
 */
@Injectable()
export class NotificationService {
  private templateCache?: Promise<NotificationTemplate[]>;

  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly templateRepo: NotificationTemplateRepository,
    private readonly logRepo: DeliveryLogRepository,
    private readonly members: OrgUserService,
    private readonly settings: SettingsService,
    private readonly queue: JobQueue,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  async notify(input: NotifyInput): Promise<{ inApp: number; email: number }> {
    const prefs = (await this.settings.getSection('notifications')).events[
      input.key
    ];
    const locale = (await this.settings.getSection('locale')).language;
    const contacts = await this.members.activeContacts([
      ...new Set(input.userIds),
    ]);
    const varsFor = (userId: string) =>
      typeof input.vars === 'function' ? input.vars(userId) : input.vars;

    let inApp = 0;
    if (prefs.inApp && contacts.length) {
      const text = await this.text(input.key, 'inApp', locale);
      const rows = contacts.map((c) => {
        const vars = varsFor(c.userId);
        return {
          userId: c.userId,
          type: input.key,
          title: render(text.subject, vars).slice(0, 200),
          body: render(text.body, vars),
          link: input.link ?? null,
          data: input.data ?? {},
          readAt: null,
        };
      });
      await this.notificationRepo.insertMany(rows);
      await this.logRepo.insertMany(
        rows.map((r) => ({
          channel: 'in_app',
          userId: r.userId,
          recipient: r.userId,
          templateKey: input.key,
          subject: r.title,
          body: null,
          link: r.link,
          status: 'sent',
          providerMessageId: null,
          error: null,
          attempts: 1,
          sentAt: new Date(),
        })),
      );
      inApp = rows.length;
    }

    let email = 0;
    const withEmail = contacts.filter((c) => !!c.email);
    if (prefs.email && withEmail.length) {
      const text = await this.text(input.key, 'email', locale);
      const logs = await this.logRepo.insertMany(
        withEmail.map((c) => {
          const vars = varsFor(c.userId);
          return {
            channel: 'email',
            userId: c.userId,
            recipient: c.email!,
            templateKey: input.key,
            subject: render(text.subject, vars).slice(0, 200),
            body: render(text.body, vars),
            link: input.link ?? null,
            status: 'queued',
            providerMessageId: null,
            error: null,
            attempts: 0,
            sentAt: null,
          };
        }),
      );
      for (const log of logs) {
        await this.queue.enqueue(
          QUEUES.notifications,
          EMAIL_DELIVERY_JOB,
          {
            orgId: this.ds.orgId,
            actorUserId: this.context.current().userId,
            data: { deliveryLogId: log.id },
          },
          { attempts: 3 },
        );
      }
      email = logs.length;
    }
    return { inApp, email };
  }

  // --- The viewer's notifications --------------------------------------------

  findMine(
    userId: string,
    filter: FilterNotificationDto,
  ): Promise<Paginated<Notification>> {
    const where: FindOptionsWhere<Notification> = { userId };
    if (filter.unreadOnly) where.readAt = IsNull();
    return this.notificationRepo.findPage(
      { where, order: { createdAt: 'DESC' } },
      filter,
    );
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    return {
      unread: await this.notificationRepo.count({
        where: { userId, readAt: IsNull() },
      }),
    };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const n = await this.notificationRepo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    if (!n.readAt) await this.notificationRepo.markRead({ id, userId });
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    return {
      updated: await this.notificationRepo.markRead({
        userId,
        readAt: IsNull(),
      }),
    };
  }

  // --- Templates and the communication log ------------------------------------

  /** Every key, channel and language: the school's text or the default. */
  async templates() {
    const own = await this.templateRepo.find();
    return Object.entries(DEFAULT_TEMPLATES).flatMap(([key, locales]) =>
      (['inApp', 'email'] as TemplateChannel[]).flatMap((channel) =>
        (Object.keys(locales) as TemplateLocale[]).map((locale) => {
          const custom = own.find(
            (t) =>
              t.key === key && t.channel === channel && t.locale === locale,
          );
          return {
            key,
            channel,
            locale,
            subject: custom?.subject ?? locales[locale].subject,
            body: custom?.body ?? locales[locale].body,
            custom: !!custom,
          };
        }),
      ),
    );
  }

  async saveTemplate(dto: SaveTemplateDto) {
    const existing = await this.templateRepo.findOne({
      where: { key: dto.key, channel: dto.channel, locale: dto.locale },
    });
    const saved = existing
      ? await this.templateRepo.save(Object.assign(existing, dto))
      : await this.templateRepo.saveNew(dto);
    this.templateCache = undefined;
    return saved;
  }

  /** Back to the code default. */
  async resetTemplate(id: string): Promise<void> {
    await this.templateRepo.findByIdOrFail(id);
    await this.templateRepo.deleteById(id);
    this.templateCache = undefined;
  }

  log(filter: FilterDeliveryLogDto): Promise<Paginated<DeliveryLog>> {
    const where: FindOptionsWhere<DeliveryLog> = {};
    if (filter.channel) where.channel = filter.channel;
    if (filter.status) where.status = filter.status;
    if (filter.templateKey) where.templateKey = filter.templateKey;
    if (filter.from || filter.to) {
      where.createdAt = Between(
        new Date(`${filter.from ?? '0001-01-01'}T00:00:00Z`),
        new Date(`${filter.to ?? '9999-12-31'}T23:59:59Z`),
      );
    }
    return this.logRepo.findPage(
      { where, order: { createdAt: 'DESC' } },
      filter,
    );
  }

  private async text(
    key: NotificationEvent,
    channel: TemplateChannel,
    locale: TemplateLocale,
  ): Promise<TemplateText> {
    this.templateCache ??= this.templateRepo.find();
    const custom = (await this.templateCache).find(
      (t) => t.key === key && t.channel === channel && t.locale === locale,
    );
    return custom ?? DEFAULT_TEMPLATES[key][locale];
  }
}
