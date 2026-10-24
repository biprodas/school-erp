import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AppHosts } from '~/shared/hosts/app-hosts';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantJobRunner } from '~/tenancy/tenant-job.runner';
import type { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { PlatformAuthService } from '~/modules/auth/services/platform-auth.service';
import type { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { GuardianService } from '~/modules/guardians/services/guardian.service';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { OPERATIONAL_ORGANIZATION_STATUSES } from '~/modules/organizations/enums/organization-status.enum';
import { StudentService } from '~/modules/students/services/student.service';

/** A child the signed-in user may see, with their current placement. */
export interface PortalChild {
  studentId: string;
  name: string;
  nameBn: string | null;
  admissionNumber: string;
  /** `self` for a student's own account. */
  relation: 'guardian' | 'self';
  enrollment: {
    id: string;
    academicYearId: string;
    classId: string;
    className: string;
    sectionId: string;
    sectionName: string;
    rollNo: string | null;
  } | null;
}

/**
 * What a portal user may reach (PRD 6.14 "guardians can only see data for
 * students linked to them"): the children of their guardian record and
 * their own student record. Every portal query goes through `child()`,
 * which answers 404 for anyone else.
 */
@Injectable()
export class PortalAccessService {
  private linked?: Promise<PortalChild[]>;

  constructor(
    private readonly guardians: GuardianService,
    private readonly students: StudentService,
    private readonly enrollments: EnrollmentService,
    private readonly academicYears: AcademicYearService,
    private readonly platformAuth: PlatformAuthService,
    private readonly runner: TenantJobRunner,
    private readonly hosts: AppHosts,
    private readonly context: RequestContext,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** This school's children of the user (cached per request). */
  children(userId?: string): Promise<PortalChild[]> {
    if (!userId || userId === this.context.current().userId) {
      this.linked ??= this.load(userId ?? this.userId);
      return this.linked;
    }
    return this.load(userId);
  }

  /** One of the user's children; 404 for any other student. */
  async child(studentId: string): Promise<PortalChild> {
    const found = (await this.children()).find(
      (c) => c.studentId === studentId,
    );
    if (!found) throw new NotFoundException(`Student "${studentId}" not found`);
    return found;
  }

  /** The child's current enrollment; 404 when not enrolled this session. */
  async enrollmentOf(studentId: string) {
    const child = await this.child(studentId);
    if (!child.enrollment) {
      throw new NotFoundException({
        message: 'Not enrolled in the current session',
        code: 'NOT_ENROLLED',
      });
    }
    return { child, enrollment: child.enrollment };
  }

  /**
   * The user's other schools (active memberships in operational schools)
   * with the children there, and the host to switch to.
   */
  async otherSchools() {
    // The job context below has no signed-in user: keep ours.
    const userId = this.userId;
    const rows = await this.memberships.find({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        orgId: Not(this.ds.orgId),
      },
      relations: { organization: true },
    });
    const schools: {
      orgId: string;
      slug: string;
      name: string;
      host: string;
      children: { studentId: string; name: string; className: string | null }[];
    }[] = [];
    for (const m of rows) {
      const org = m.organization;
      if (!OPERATIONAL_ORGANIZATION_STATUSES.has(org.status)) continue;
      const children = await this.runner.run(org.id, async (resolve) => {
        const access = await resolve(PortalAccessService);
        return (await access.children(userId)).map((c) => ({
          studentId: c.studentId,
          name: c.name,
          className: c.enrollment?.className ?? null,
        }));
      });
      schools.push({
        orgId: org.id,
        slug: org.slug,
        name: org.name,
        host: this.hosts.schoolHost(org.slug),
        children,
      });
    }
    return schools.filter((s) => s.children.length);
  }

  /** A one-time code for another school where the user is a member. */
  async handoff(orgId: string) {
    const issued = await this.platformAuth.issueHandoff(this.userId, orgId);
    const host = this.hosts.schoolHost(issued.orgSlug);
    return {
      ...issued,
      redirectUrl: this.hosts.url(
        host,
        `/auth/handoff?code=${encodeURIComponent(issued.code)}&next=/portal`,
      ),
    };
  }

  private async load(userId: string): Promise<PortalChild[]> {
    const family = await this.guardians.studentsOfUser(userId);
    const ids = [
      ...new Set([
        ...family.childIds,
        ...(family.ownStudentId ? [family.ownStudentId] : []),
      ]),
    ];
    if (!ids.length) return [];
    const year = await this.academicYears.findCurrent();
    const students = await this.students.findManyByIds(ids);
    const current = new Map<string, StudentEnrollment>();
    if (year) {
      for (const e of (await this.enrollments.findActiveInYear(year.id)).filter(
        (x) => ids.includes(x.studentId),
      )) {
        current.set(e.studentId, e);
      }
    }
    const detailed = new Map(
      (
        await this.enrollments.findByIds([...current.values()].map((e) => e.id))
      ).map((e) => [e.studentId, e]),
    );
    return students
      .map((s) => {
        const e = detailed.get(s.id);
        return {
          studentId: s.id,
          name: s.fullName,
          nameBn: s.nameBn,
          admissionNumber: s.admissionNumber,
          relation:
            s.id === family.ownStudentId
              ? ('self' as const)
              : ('guardian' as const),
          enrollment: e
            ? {
                id: e.id,
                academicYearId: e.academicYearId,
                classId: e.classId,
                className: e.schoolClass?.name ?? '',
                sectionId: e.sectionId,
                sectionName: e.section?.name ?? '',
                rollNo: e.rollNo,
              }
            : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private get userId(): string {
    return this.context.current().userId!;
  }
}
