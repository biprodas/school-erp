import { Injectable } from '@nestjs/common';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { Paginated } from '~/common/dto/paginated.dto';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { FilterAuditLogDto } from '../dto/filter-audit-log.dto';
import { AuditEntry, auditRow } from './audit-entry';
import { auditLogWhere } from './audit-log-filter';

/**
 * Writes the school's audit log. Rows go through the request's tenant
 * connection, so a call inside `ds.runInTransaction` commits or rolls back
 * with the change it describes; outside one it commits at once (a failed
 * sign-in is kept although the request fails). Actor, IP, user agent and
 * request id come from the request context.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly auditRepo: AuditLogRepository,
    private readonly context: RequestContext,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.auditRepo.saveNew(auditRow(entry, this.context.current()));
  }

  findFiltered(filter: FilterAuditLogDto): Promise<Paginated<AuditLog>> {
    return this.auditRepo.findFiltered(auditLogWhere<AuditLog>(filter), filter);
  }
}
