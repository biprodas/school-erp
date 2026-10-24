import { Inject, Injectable } from '@nestjs/common';
import { DeepPartial, In } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { AttendanceRecord } from '../entities/attendance-record.entity';

/** Count of one status for one enrollment (or register). */
export interface StatusCount {
  key: string;
  statusCode: string;
  n: number;
}

/** Filters for the day-status aggregates. */
export interface DayStatusFilter {
  from: string;
  to: string;
  /** null = every section. */
  sectionIds: string[] | null;
  enrollmentIds?: string[];
}

/**
 * The register that gives a section its day status: the day register, or
 * in period mode the first period taken that day (lowest display order).
 * `$1` org, `$2`/`$3` the range, `$4` section ids or null.
 */
const DAY_REGISTERS = `
  SELECT DISTINCT ON (r."section_id", r."date") r."id", r."section_id", r."date"
  FROM "attendance_registers" r
  LEFT JOIN "periods" p ON p."id" = r."period_id"
  WHERE r."org_id" = $1 AND r."date" BETWEEN $2 AND $3
    AND ($4::uuid[] IS NULL OR r."section_id" = ANY($4::uuid[]))
  ORDER BY r."section_id", r."date", (r."period_id" IS NOT NULL),
           p."display_order", p."name"`;

@Injectable()
export class AttendanceRecordRepository extends BaseTenantRepository<AttendanceRecord> {
  constructor(
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {
    super(ds, AttendanceRecord, 'AttendanceRecord');
  }

  /** A register's records with their students. */
  findByRegister(registerId: string): Promise<AttendanceRecord[]> {
    return this.repo.find({
      where: { registerId },
      relations: { enrollment: { student: true } },
    });
  }

  /** One enrollment's records in some registers (leave approval). */
  findForEnrollment(
    enrollmentId: string,
    registerIds: string[],
  ): Promise<AttendanceRecord[]> {
    if (!registerIds.length) return Promise.resolve([]);
    return this.repo.find({
      where: { enrollmentId, registerId: In(registerIds) },
    });
  }

  async insertMany(rows: DeepPartial<AttendanceRecord>[]): Promise<void> {
    if (rows.length) await this.repo.insert(rows);
  }

  /** Some enrollments' records in a register (ids after an insert). */
  findByRegisterAndEnrollments(
    registerId: string,
    enrollmentIds: string[],
  ): Promise<AttendanceRecord[]> {
    if (!enrollmentIds.length) return Promise.resolve([]);
    return this.repo.find({
      where: { registerId, enrollmentId: In(enrollmentIds) },
    });
  }

  async updateFields(
    id: string,
    patch: Partial<
      Pick<AttendanceRecord, 'statusCode' | 'remark' | 'updatedBy'>
    >,
  ): Promise<void> {
    await this.repo.update({ id }, patch);
  }

  countWithStatus(statusCode: string): Promise<number> {
    return this.repo.count({ where: { statusCode } });
  }

  /** Records of any of the enrollments (promotion rollback checks). */
  countForEnrollments(enrollmentIds: string[]): Promise<number> {
    if (!enrollmentIds.length) return Promise.resolve(0);
    return this.repo.count({ where: { enrollmentId: In(enrollmentIds) } });
  }

  /** Status counts per register, for submitted registers. */
  async countByRegister(registerIds: string[]): Promise<StatusCount[]> {
    if (!registerIds.length) return [];
    const rows = await this.ds
      .getManager()
      .query<{ key: string; status_code: string; n: number }[]>(
        `SELECT "register_id" AS "key", "status_code", count(*)::int AS "n"
       FROM "attendance_records"
       WHERE "org_id" = $1 AND "register_id" = ANY($2::uuid[])
       GROUP BY "register_id", "status_code"`,
        [this.orgId, registerIds],
      );
    return rows.map((r) => ({ key: r.key, statusCode: r.status_code, n: r.n }));
  }

  /** Day-status counts per enrollment over a range (defaulters, 360). */
  async countDaysByEnrollment(filter: DayStatusFilter): Promise<StatusCount[]> {
    const rows = await this.ds
      .getManager()
      .query<{ key: string; status_code: string; n: number }[]>(
        `WITH d AS (${DAY_REGISTERS})
       SELECT rec."enrollment_id" AS "key", rec."status_code", count(*)::int AS "n"
       FROM "attendance_records" rec
       JOIN d ON d."id" = rec."register_id"
       WHERE rec."org_id" = $1
         AND ($5::uuid[] IS NULL OR rec."enrollment_id" = ANY($5::uuid[]))
       GROUP BY rec."enrollment_id", rec."status_code"`,
        [
          this.orgId,
          filter.from,
          filter.to,
          filter.sectionIds,
          filter.enrollmentIds ?? null,
        ],
      );
    return rows.map((r) => ({ key: r.key, statusCode: r.status_code, n: r.n }));
  }

  /** Each enrollment's day status per day over a range (monthly register). */
  async dayStatuses(
    filter: DayStatusFilter,
  ): Promise<{ enrollmentId: string; date: string; statusCode: string }[]> {
    const rows = await this.ds
      .getManager()
      .query<{ enrollment_id: string; date: string; status_code: string }[]>(
        `WITH d AS (${DAY_REGISTERS})
       SELECT rec."enrollment_id", to_char(d."date", 'YYYY-MM-DD') AS "date",
              rec."status_code"
       FROM "attendance_records" rec
       JOIN d ON d."id" = rec."register_id"
       WHERE rec."org_id" = $1
         AND ($5::uuid[] IS NULL OR rec."enrollment_id" = ANY($5::uuid[]))`,
        [
          this.orgId,
          filter.from,
          filter.to,
          filter.sectionIds,
          filter.enrollmentIds ?? null,
        ],
      );
    return rows.map((r) => ({
      enrollmentId: r.enrollment_id,
      date: r.date,
      statusCode: r.status_code,
    }));
  }
}
