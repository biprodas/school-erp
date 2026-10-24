import { Inject, Injectable } from '@nestjs/common';
import { Brackets, In } from 'typeorm';
import { normalizePhone } from '~/common/identity/identifier';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Student } from '../entities/student.entity';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import {
  STUDENT_NAME_BN_EXPR,
  STUDENT_NAME_EXPR,
  likeEscape,
} from '../student-search';
import type { StudentStatus } from '../enums/student-status.enum';

export interface StudentSearch {
  q?: string;
  id?: string;
  admissionNumber?: string;
  status?: StudentStatus;
  gender?: string;
  religion?: string;
  /** Enrolled in this session (and class / section). */
  placement?: { academicYearId: string; classId?: string; sectionId?: string };
  /** `AccessScope` answer: null = all, else enrolled in one of these. */
  allowedSectionIds?: string[] | null;
}

/** Writable columns (relations and the virtual name excluded). */
export type StudentPatch = Partial<
  Omit<
    Student,
    | 'user'
    | 'photoFile'
    | 'guardians'
    | 'addresses'
    | 'documents'
    | 'emergencyContacts'
    | 'notes'
    | 'medicalRecord'
    | 'fullName'
    | 'syncFullName'
  >
>;

/**
 * Students. The search reads `student_enrollments` and the guardian
 * tables in `EXISTS` subqueries (read-only, by table name): placement and
 * guardian phone are part of finding a student, and those modules depend
 * on this one, not the other way round.
 */
@Injectable()
export class StudentRepository extends BaseTenantRepository<Student> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Student, 'Student');
  }

  findByAdmissionNumber(admissionNumber: string): Promise<Student | null> {
    return this.repo.findOne({ where: { admissionNumber } });
  }

  findByUserId(userId: string): Promise<Student | null> {
    return this.repo.findOne({ where: { userId } });
  }

  /** Students by id, with only what notifications need. */
  findManyByIds(ids: string[]): Promise<Student[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo.find({ where: { id: In(ids) } });
  }

  findByRfid(rfidCardNo: string): Promise<Student | null> {
    return this.repo.findOne({ where: { rfidCardNo } });
  }

  async updateFields(id: string, patch: StudentPatch): Promise<void> {
    if (Object.values(patch).every((v) => v === undefined)) return;
    await this.repo.update({ id }, patch);
  }

  /** Whether the student is enrolled in one of the sections. */
  async isInSections(
    studentId: string,
    sectionIds: string[],
  ): Promise<boolean> {
    if (!sectionIds.length) return false;
    const count = await this.repo
      .createQueryBuilder('s')
      .where('s.id = :studentId AND s.org_id = :orgId', {
        studentId,
        orgId: this.orgId,
      })
      .andWhere(
        `EXISTS (SELECT 1 FROM "student_enrollments" e
          WHERE e.student_id = s.id AND e.org_id = :orgId
            AND e.section_id IN (:...sectionIds))`,
        { sectionIds },
      )
      .getCount();
    return count > 0;
  }

  async search(
    criteria: StudentSearch,
    page: PaginationQueryDto = {},
  ): Promise<Paginated<Student>> {
    const { page: pageNo = 1, limit = DEFAULT_PAGE_SIZE } = page;
    const allowed = criteria.allowedSectionIds;
    if (allowed && !allowed.length) {
      return new Paginated<Student>([], 0, { page: pageNo, limit });
    }

    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.org_id = :orgId', { orgId: this.orgId });
    if (criteria.id) qb.andWhere('s.id = :id', { id: criteria.id });
    if (criteria.admissionNumber) {
      qb.andWhere('s.admission_number = :admissionNumber', {
        admissionNumber: criteria.admissionNumber,
      });
    }
    if (criteria.status) {
      qb.andWhere('s.status = :status', { status: criteria.status });
    }
    if (criteria.gender) {
      qb.andWhere('s.gender = :gender', { gender: criteria.gender });
    }
    if (criteria.religion) {
      qb.andWhere('lower(s.religion) = lower(:religion)', {
        religion: criteria.religion,
      });
    }

    const q = criteria.q?.trim();
    if (q) {
      const phone = normalizePhone(q);
      qb.andWhere(
        new Brackets((or) => {
          or.where(`${STUDENT_NAME_EXPR('s')} LIKE :like`, {
            like: `%${likeEscape(q.toLowerCase())}%`,
          })
            .orWhere(`${STUDENT_NAME_BN_EXPR('s')} LIKE :likeBn`, {
              likeBn: `%${likeEscape(q)}%`,
            })
            .orWhere('lower(s.admission_number) = lower(:raw)', { raw: q });
          if (phone) {
            or.orWhere('s.phone = :phone', { phone }).orWhere(
              `EXISTS (SELECT 1 FROM "student_guardians" sg
                 JOIN "guardians" g ON g.id = sg.guardian_id AND g.deleted_at IS NULL
                 WHERE sg.student_id = s.id AND sg.org_id = :orgId AND g.phone = :phone)`,
            );
          }
        }),
      );
    }

    const placement = criteria.placement;
    if (placement) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "student_enrollments" e
          WHERE e.student_id = s.id AND e.org_id = :orgId
            AND e.academic_year_id = :yearId
            ${placement.classId ? 'AND e.class_id = :classId' : ''}
            ${placement.sectionId ? 'AND e.section_id = :sectionId' : ''})`,
        {
          yearId: placement.academicYearId,
          classId: placement.classId,
          sectionId: placement.sectionId,
        },
      );
    }
    if (allowed) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "student_enrollments" ae
          WHERE ae.student_id = s.id AND ae.org_id = :orgId
            AND ae.section_id IN (:...allowed))`,
        { allowed },
      );
    }

    const [items, total] = await qb
      .orderBy('s.first_name', 'ASC')
      .addOrderBy('s.last_name', 'ASC')
      .addOrderBy('s.id', 'ASC')
      .skip((pageNo - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return new Paginated(items, total, { page: pageNo, limit });
  }
}
