import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In, IsNull, LessThanOrEqual } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { DEFAULT_PAGE_SIZE } from '~/common/dto/pagination-query.dto';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { FileService, type IncomingFile } from '~/modules/files/file.service';
import { NotificationService } from '~/modules/notifications/services/notification.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { inAudience, type Audience } from '../audience';
import {
  CreateNoticeDto,
  FilterNoticeDto,
  UpdateNoticeDto,
} from '../dto/notice.dto';
import type { Notice } from '../entities/notice.entity';
import {
  NoticeReadRepository,
  NoticeRepository,
} from '../repositories/notice.repositories';
import { AudienceService } from './audience.service';

const NEEDS_IDS = new Set(['role', 'class', 'section', 'group', 'users']);

export type NoticeView = Notice & { read: boolean };

const isLive = (n: Notice, now: Date) =>
  n.publishAt <= now && (!n.expiresAt || n.expiresAt > now);

/**
 * The notice board (PRD 6.13): targeted, scheduled, pinned, expiring and
 * public notices with read receipts. The feed shows a viewer what their
 * audience reaches (`AudienceService.viewer`); publishing notifies the
 * audience once (`publishDue`, also run by the scheduler for scheduled
 * notices).
 */
@Injectable()
export class NoticeService {
  constructor(
    private readonly noticeRepo: NoticeRepository,
    private readonly readRepo: NoticeReadRepository,
    private readonly audiences: AudienceService,
    private readonly notifications: NotificationService,
    private readonly members: OrgUserService,
    private readonly files: FileService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** Managers: every notice, newest first. */
  async list(filter: FilterNoticeDto): Promise<Paginated<Notice>> {
    const now = new Date();
    const page = await this.noticeRepo.findPage(
      {
        where: filter.all ? {} : { publishAt: LessThanOrEqual(now) },
        order: { pinned: 'DESC', publishAt: 'DESC' },
      },
      filter,
    );
    return page;
  }

  /** What the viewer's audience reaches, pinned first, with read flags. */
  async feed(
    userId: string,
    page: { page?: number; limit?: number } = {},
  ): Promise<Paginated<NoticeView>> {
    const now = new Date();
    const viewer = await this.audiences.viewer(userId);
    const visible = (
      await this.noticeRepo.find({
        where: { publishAt: LessThanOrEqual(now) },
        order: { pinned: 'DESC', publishAt: 'DESC' },
        take: 500,
      })
    ).filter((n) => isLive(n, now) && inAudience(n.audience, viewer));
    const { page: p = 1, limit = DEFAULT_PAGE_SIZE } = page;
    const slice = visible.slice((p - 1) * limit, p * limit);
    const read = new Set(
      slice.length
        ? (
            await this.readRepo.find({
              where: { userId, noticeId: In(slice.map((n) => n.id)) },
            })
          ).map((r) => r.noticeId)
        : [],
    );
    return new Paginated(
      slice.map((n) => Object.assign(n, { read: read.has(n.id) })),
      visible.length,
      { page: p, limit },
    );
  }

  /** One notice the viewer may see (404 otherwise). */
  async findForViewer(id: string, userId: string): Promise<NoticeView> {
    const notice = await this.noticeRepo.findById(id);
    if (
      !notice ||
      !isLive(notice, new Date()) ||
      !inAudience(notice.audience, await this.audiences.viewer(userId))
    ) {
      throw new NotFoundException(`Notice "${id}" not found`);
    }
    const read = !!(await this.readRepo.findOne({
      where: { noticeId: id, userId },
    }));
    return Object.assign(notice, { read });
  }

  findById(id: string): Promise<Notice> {
    return this.noticeRepo.findByIdOrFail(id);
  }

  /**
   * `allowedSections`: for a manager with assigned scope, the only
   * sections they may target (null = any audience).
   */
  async create(
    dto: CreateNoticeDto,
    allowedSections: string[] | null,
  ): Promise<Notice> {
    const audience = checkAudience(dto.audience, allowedSections);
    for (const id of dto.attachmentFileIds ?? []) await this.files.findById(id);
    const notice = await this.noticeRepo.saveNew({
      title: dto.title,
      body: dto.body,
      audience,
      publishAt: dto.publishAt ? new Date(dto.publishAt) : new Date(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      pinned: dto.pinned ?? false,
      isPublic: dto.isPublic ?? false,
      attachmentFileIds: dto.attachmentFileIds ?? [],
      createdBy: this.context.current().userId,
      notifiedAt: null,
    });
    await this.publishDue();
    return this.findById(notice.id);
  }

  async update(
    id: string,
    dto: UpdateNoticeDto,
    allowedSections: string[] | null,
  ): Promise<Notice> {
    const notice = await this.findById(id);
    this.assertMayEdit(notice, allowedSections);
    const audience = dto.audience
      ? checkAudience(dto.audience, allowedSections)
      : undefined;
    for (const fid of dto.attachmentFileIds ?? [])
      await this.files.findById(fid);
    await this.noticeRepo.updateFields(id, {
      title: dto.title,
      body: dto.body,
      audience,
      publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
      expiresAt:
        dto.expiresAt === undefined
          ? undefined
          : dto.expiresAt
            ? new Date(dto.expiresAt)
            : null,
      pinned: dto.pinned,
      isPublic: dto.isPublic,
      attachmentFileIds: dto.attachmentFileIds,
    });
    await this.publishDue();
    return this.findById(id);
  }

  async remove(id: string, allowedSections: string[] | null): Promise<void> {
    this.assertMayEdit(await this.findById(id), allowedSections);
    await this.noticeRepo.deleteById(id);
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.findForViewer(id, userId);
    await this.readRepo.markRead(id, userId);
  }

  /** Read receipts: who the notice reaches and who has read it. */
  async reads(id: string) {
    const notice = await this.findById(id);
    const recipients = await this.audiences.recipients(notice.audience);
    const reads = await this.readRepo.find({ where: { noticeId: id } });
    const names = new Map(
      (await this.members.activeContacts(reads.map((r) => r.userId))).map(
        (c) => [c.userId, c.name],
      ),
    );
    return {
      noticeId: id,
      audience: recipients.length,
      read: reads.length,
      readers: reads.map((r) => ({
        userId: r.userId,
        name: names.get(r.userId) ?? '',
        readAt: r.readAt,
      })),
    };
  }

  async uploadAttachment(file: IncomingFile): Promise<{ fileId: string }> {
    return { fileId: (await this.files.upload(file, 'attachment')).id };
  }

  async attachmentUrl(id: string, fileId: string, userId: string | null) {
    const notice = userId
      ? await this.findForViewer(id, userId)
      : await this.findById(id);
    if (!notice.attachmentFileIds.includes(fileId)) {
      throw new NotFoundException('Attachment not found');
    }
    return { url: await this.files.getDownloadUrl(fileId) };
  }

  /** Public notices for the school's home page. */
  async publicNotices(limit = 20): Promise<Notice[]> {
    const now = new Date();
    return (
      await this.noticeRepo.find({
        where: { isPublic: true, publishAt: LessThanOrEqual(now) },
        order: { pinned: 'DESC', publishAt: 'DESC' },
        take: 50,
      })
    )
      .filter((n) => isLive(n, now))
      .slice(0, limit);
  }

  /** Notifies the audience of every notice that is due and not yet notified. */
  async publishDue(now = new Date()): Promise<number> {
    const due = await this.noticeRepo.find({
      where: { publishAt: LessThanOrEqual(now), notifiedAt: IsNull() },
    });
    for (const notice of due) {
      if (notice.expiresAt && notice.expiresAt <= now) {
        await this.noticeRepo.updateFields(notice.id, { notifiedAt: now });
        continue;
      }
      // Claim it first, so a second run doesn't notify twice.
      await this.noticeRepo.updateFields(notice.id, { notifiedAt: now });
      await this.notifications.notify({
        userIds: await this.audiences.recipients(notice.audience),
        key: 'noticePublished',
        vars: {
          title: notice.title,
          summary:
            notice.body.length > 280
              ? `${notice.body.slice(0, 277)}…`
              : notice.body,
        },
        link: `/notices/${notice.id}`,
        data: { noticeId: notice.id },
      });
    }
    return due.length;
  }

  private assertMayEdit(notice: Notice, allowedSections: string[] | null) {
    if (allowedSections === null) return;
    if (notice.createdBy !== this.context.current().userId) {
      throw new ForbiddenException({
        message: 'You can only change your own notices',
        code: 'NOT_YOUR_NOTICE',
      });
    }
  }
}

function checkAudience(
  dto: { type: Audience['type']; ids?: string[] },
  allowedSections: string[] | null,
): Audience {
  const ids = [...new Set(dto.ids ?? [])];
  if (NEEDS_IDS.has(dto.type) && !ids.length) {
    throw new BadRequestException({
      message: `A ${dto.type} audience needs ids`,
      code: 'AUDIENCE_IDS_REQUIRED',
    });
  }
  if (
    allowedSections !== null &&
    (dto.type !== 'section' || ids.some((id) => !allowedSections.includes(id)))
  ) {
    throw new ForbiddenException({
      message: 'You can send notices only to the sections you teach',
      code: 'AUDIENCE_OUT_OF_SCOPE',
    });
  }
  return { type: dto.type, ids: NEEDS_IDS.has(dto.type) ? ids : [] };
}
