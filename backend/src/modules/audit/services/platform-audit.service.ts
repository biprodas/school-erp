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
 * commits at once. A signed-in actor is recorded as `platform`.
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
    const row = auditRow(rest, this.context.current(), AuditActorType.PLATFORM);
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
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new Paginated(items, total, { page, limit });
  }
}
