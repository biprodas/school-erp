import { Injectable } from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import type { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { GuardianService } from '~/modules/guardians/services/guardian.service';
import { RoleService } from '~/modules/rbac/services/role.service';
import { SectionService } from '~/modules/sections/section.service';
import { StudentService } from '~/modules/students/services/student.service';
import { TeachingService } from '~/modules/teaching/services/teaching.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import type { Audience, Viewer } from '../audience';

/**
 * Turns notice audiences into people, both ways: which notices a viewer
 * sees (`viewer`, for the feed) and whom a notice reaches (`recipients`,
 * for notifications and read receipts). Class, section and group
 * audiences reach the students of the current session, their guardians
 * and the sections' class teachers.
 */
@Injectable()
export class AudienceService {
  constructor(
    private readonly members: OrgUserService,
    private readonly roles: RoleService,
    private readonly guardians: GuardianService,
    private readonly enrollments: EnrollmentService,
    private readonly academicYears: AcademicYearService,
    private readonly sections: SectionService,
    private readonly teaching: TeachingService,
    private readonly students: StudentService,
  ) {}

  async viewer(userId: string): Promise<Viewer> {
    const [contact] = await this.members.activeContacts([userId]);
    const family = await this.guardians.studentsOfUser(userId);
    const year = await this.academicYears.findCurrent();
    const studentIds = [
      ...family.childIds,
      ...(family.ownStudentId ? [family.ownStudentId] : []),
    ];
    const enrollments: StudentEnrollment[] = [];
    if (year) {
      for (const id of studentIds) {
        const e = await this.enrollments.findForStudentYear(id, year.id);
        if (e) enrollments.push(e);
      }
    }
    const sectionIds = new Set(enrollments.map((e) => e.sectionId));
    const classIds = new Set(enrollments.map((e) => e.classId));
    if (contact && !contact.portalOnly && year) {
      const taught = await this.teaching.activeAssignmentsForUser(userId);
      const taughtIds = [
        ...taught.sections,
        ...taught.subjects.map((s) => s.sectionId),
      ];
      const inYear = await this.sections.findInYear(year.id);
      for (const id of taughtIds) {
        sectionIds.add(id);
        const s = inYear.find((x) => x.id === id);
        if (s) classIds.add(s.classId);
      }
    }
    return {
      userId,
      roleIds: contact?.roleIds ?? [],
      portalOnly: contact?.portalOnly ?? false,
      isGuardian: !!family.guardianId,
      isStudent: !!family.ownStudentId,
      sectionIds: [...sectionIds],
      classIds: [...classIds],
      groupIds: [
        ...new Set(
          enrollments
            .map((e) => e.subjectGroupId)
            .filter((g): g is string => !!g),
        ),
      ],
    };
  }

  /** Active members a notice reaches. */
  async recipients(audience: Audience): Promise<string[]> {
    const ids = audience.ids ?? [];
    switch (audience.type) {
      case 'all':
        return (await this.members.activeContacts()).map((c) => c.userId);
      case 'staff':
        return (await this.members.activeContacts())
          .filter((c) => !c.portalOnly)
          .map((c) => c.userId);
      case 'guardians':
        return this.active(await this.guardians.allUserIds());
      case 'students':
        return this.active(await this.studentAccounts(() => true));
      case 'role': {
        const users = new Set<string>();
        for (const roleId of ids) {
          for (const u of await this.roles.findUserIdsWithRole(roleId))
            users.add(u);
        }
        return this.active([...users]);
      }
      case 'users':
        return this.active(ids);
      default:
        return this.active(await this.familiesAndTeachers(audience));
    }
  }

  /** Students' own accounts for enrollments that pass `keep`. */
  private async studentAccounts(keep: (e: StudentEnrollment) => boolean) {
    const year = await this.academicYears.findCurrent();
    if (!year) return [];
    const studentIds = (await this.enrollments.findActiveInYear(year.id))
      .filter(keep)
      .map((e) => e.studentId);
    return (await this.students.findManyByIds(studentIds))
      .map((s) => s.userId)
      .filter((u): u is string => !!u);
  }

  private async familiesAndTeachers(audience: Audience): Promise<string[]> {
    const year = await this.academicYears.findCurrent();
    if (!year) return [];
    const ids = audience.ids ?? [];
    const keep = (e: StudentEnrollment) =>
      audience.type === 'class'
        ? ids.includes(e.classId)
        : audience.type === 'section'
          ? ids.includes(e.sectionId)
          : !!e.subjectGroupId && ids.includes(e.subjectGroupId);
    const enrollments = (
      await this.enrollments.findActiveInYear(year.id)
    ).filter(keep);
    const users = new Set<string>();
    for (const list of (
      await this.guardians.familyUserIds(enrollments.map((e) => e.studentId))
    ).values()) {
      for (const u of list) users.add(u);
    }
    const sectionIds =
      audience.type === 'class'
        ? (await this.sections.findInYear(year.id))
            .filter((s) => ids.includes(s.classId))
            .map((s) => s.id)
        : audience.type === 'section'
          ? ids
          : [...new Set(enrollments.map((e) => e.sectionId))];
    for (const u of await this.teaching.classTeacherUserIds(sectionIds))
      users.add(u);
    return [...users];
  }

  private async active(userIds: string[]): Promise<string[]> {
    return (await this.members.activeContacts(userIds)).map((c) => c.userId);
  }
}
