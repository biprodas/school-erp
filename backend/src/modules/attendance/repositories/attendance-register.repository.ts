import { Inject, Injectable } from '@nestjs/common';
import { Between, In, IsNull } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { AttendanceRegister } from '../entities/attendance-register.entity';

/** Which register of a section and day: the day one, or a period's. */
export interface RegisterKey {
  sectionId: string;
  date: string;
  periodId: string | null;
}

@Injectable()
export class AttendanceRegisterRepository extends BaseTenantRepository<AttendanceRegister> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, AttendanceRegister, 'AttendanceRegister');
  }

  findByKey(
    key: RegisterKey,
    lock = false,
  ): Promise<AttendanceRegister | null> {
    return this.repo.findOne({
      where: {
        sectionId: key.sectionId,
        date: key.date,
        periodId: key.periodId ?? IsNull(),
      },
      ...(lock && { lock: { mode: 'pessimistic_write' as const } }),
    });
  }

  /**
   * Creates the register unless it exists (a concurrent submit may have
   * made it), then returns it row-locked until the transaction ends, so
   * submissions of one register queue instead of interleaving.
   */
  async getOrCreateLocked(
    key: RegisterKey,
    fields: Pick<
      AttendanceRegister,
      'takenBy' | 'submittedAt' | 'clientRequestId'
    >,
  ): Promise<{ register: AttendanceRegister; created: boolean }> {
    const inserted = await this.repo
      .createQueryBuilder()
      .insert()
      .into(AttendanceRegister)
      .values({ orgId: this.orgId, ...key, ...fields })
      .orIgnore()
      .returning(['id'])
      .execute();
    const created = (inserted.raw as unknown[]).length > 0;
    const register = await this.findByKey(key, true);
    if (!register) throw new Error('Attendance register vanished');
    return { register, created };
  }

  /** Registers of the sections on a day (every period). */
  findOnDate(
    date: string,
    sectionIds: string[] | null,
  ): Promise<AttendanceRegister[]> {
    if (sectionIds?.length === 0) return Promise.resolve([]);
    return this.repo.find({
      where: { date, ...(sectionIds && { sectionId: In(sectionIds) }) },
      relations: { period: true },
    });
  }

  /** A section's registers over a range (every period), oldest first. */
  findForSection(
    sectionId: string,
    from: string,
    to: string,
  ): Promise<AttendanceRegister[]> {
    return this.repo.find({
      where: { sectionId, date: Between(from, to) },
      relations: { period: true },
      order: { date: 'ASC' },
    });
  }

  async touch(
    id: string,
    patch: Partial<Pick<AttendanceRegister, 'clientRequestId'>>,
  ): Promise<void> {
    // Always bumps `updated_at`, the "last changed" time.
    await this.repo.update({ id }, { ...patch, updatedAt: new Date() });
  }
}
