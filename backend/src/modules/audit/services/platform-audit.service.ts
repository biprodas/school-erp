import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { DEFAULT_PAGE_SIZE } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import { PlatformAuditLog } from '../entities/platform-audit-log.entity';
import { AuditActorType } from '../enums/audit-actor-type.enum';
import { FilterPlatformAuditLogDto } from '../dto/filter-audit-log.dto';
import { AuditEntry, auditRow } from './audit-entry';
import { auditLogWhere } from './audit-log-filter';

export interface PlatformAuditEntry extends AuditEntry {
  /** The school the action concerns, if any. */
  orgId?: string | null;
}

/**
 * Writes the platform audit log through the root connection. Pass the
 * transaction's `manager` to commit the row with the change; without one it
 * commits at once. A signed-in super-admin is recorded as `platform`, other
 * actors as `user`, and work without an actor as `system`.
 */
@Injectable()
export class PlatformAuditService {
  constructor(
    @InjectRepository(PlatformAuditLog)
    private readonly repo: Repository<PlatformAuditLog>,
    private readonly context: RequestContext,
  ) {}

  async record(
    entry: PlatformAuditEntry,
    manager?: EntityManager,
  ): Promise<void> {
    const { orgId, ...rest } = entry;
    const ctx = this.context.current();
    // Only a signed-in super-admin acts as `platform`; anyone else signed in
    // to the platform realm (a school user managing their account) is a
    // `user`. Sign-in flows name their actor, who isn't signed in yet: `user`.
    const signedInType = ctx.isAdmin
      ? AuditActorType.PLATFORM
      : AuditActorType.USER;
    const row = auditRow(rest, ctx, signedInType);
    const repo = manager ? manager.getRepository(PlatformAuditLog) : this.repo;
    await repo.save(repo.create({ ...row, orgId: orgId ?? null }));
  }

  async findFiltered(
    filter: FilterPlatformAuditLogDto,
  ): Promise<Paginated<PlatformAuditLog>> {
    const where = auditLogWhere<PlatformAuditLog>(filter);
    if (filter.orgId) where.orgId = filter.orgId;
    const page = filter.page ?? 1;
    const limit = filter.limit ?? DEFAULT_PAGE_SIZE;
    const [items, total] = await this.repo.findAndCount({
      where,
      // `seq` breaks ties between rows written at the same instant.
      order: { createdAt: 'DESC', seq: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new Paginated(items, total, { page, limit });
  }
}
