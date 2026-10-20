import type { Request } from 'express';
import { AccessScope } from './access-scope.service';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { RoleScope } from '~/modules/rbac/enums/role-scope.enum';
import { PermissionResolverService } from '~/modules/rbac/services/permission-resolver.service';
import {
  TeachingAssignments,
  TeachingService,
} from '~/modules/teaching/services/teaching.service';

const P = PERMISSIONS;

/** Class 6 section A as class teacher; Math in 7A and 7B. */
const ASSIGNMENTS: TeachingAssignments = {
  classSections: [{ classId: 'c6', sectionId: 'sA' }],
  subjects: [
    { classId: 'c7', sectionId: 'sA', subjectId: 'math' },
    { classId: 'c7', sectionId: 'sB', subjectId: 'math' },
    { classId: 'c6', sectionId: 'sA', subjectId: 'math' },
  ],
};

describe('AccessScope', () => {
  let resolver: { getPermissionScopes: jest.Mock };
  let teaching: { activeAssignmentsForUser: jest.Mock };

  const build = (
    scopes: Record<string, RoleScope>,
    user: { userId: string; isAdmin: boolean } | null = {
      userId: 'u1',
      isAdmin: false,
    },
  ) => {
    resolver.getPermissionScopes.mockResolvedValue(
      new Map(Object.entries(scopes)),
    );
    return new AccessScope(
      { user } as unknown as Request,
      resolver as unknown as PermissionResolverService,
      teaching as unknown as TeachingService,
    );
  };

  beforeEach(() => {
    resolver = { getPermissionScopes: jest.fn() };
    teaching = {
      activeAssignmentsForUser: jest.fn().mockResolvedValue(ASSIGNMENTS),
    };
  });

  describe('school admin', () => {
    it('is unrestricted without reading roles or assignments', async () => {
      const scope = build({}, { userId: 'u1', isAdmin: true });

      await expect(scope.can(P.STUDENTS_UPDATE)).resolves.toBe(true);
      await expect(scope.sections(P.STUDENTS_READ)).resolves.toBeNull();
      await expect(
        scope.subjectAssignments(P.STUDENTS_READ),
      ).resolves.toBeNull();
      expect(resolver.getPermissionScopes).not.toHaveBeenCalled();
      expect(teaching.activeAssignmentsForUser).not.toHaveBeenCalled();
    });
  });

  describe('school-wide role', () => {
    it('is unrestricted for the keys it grants', async () => {
      const scope = build({ [P.STUDENTS_READ]: RoleScope.SCHOOL });

      await expect(scope.can(P.STUDENTS_READ)).resolves.toBe(true);
      await expect(scope.sections(P.STUDENTS_READ)).resolves.toBeNull();
      await expect(
        scope.canAccessSection(P.STUDENTS_READ, {
          classId: 'c9',
          sectionId: 'sZ',
        }),
      ).resolves.toBe(true);
      expect(teaching.activeAssignmentsForUser).not.toHaveBeenCalled();
    });
  });

  describe('assigned role', () => {
    it('reaches class-teacher and subject-teacher sections, once each', async () => {
      const scope = build({ [P.STUDENTS_READ]: RoleScope.ASSIGNED });

      const sections = await scope.sections(P.STUDENTS_READ);

      expect(sections).toHaveLength(3);
      expect(sections).toEqual(
        expect.arrayContaining([
          { classId: 'c6', sectionId: 'sA' },
          { classId: 'c7', sectionId: 'sA' },
          { classId: 'c7', sectionId: 'sB' },
        ]),
      );
      expect(teaching.activeAssignmentsForUser).toHaveBeenCalledWith('u1');
    });

    it('matches a section by class and section, not by section alone', async () => {
      const scope = build({ [P.STUDENTS_READ]: RoleScope.ASSIGNED });

      await expect(
        scope.canAccessSection(P.STUDENTS_READ, {
          classId: 'c6',
          sectionId: 'sA',
        }),
      ).resolves.toBe(true);
      // Section A of Class 8 is a different class-section.
      await expect(
        scope.canAccessSection(P.STUDENTS_READ, {
          classId: 'c8',
          sectionId: 'sA',
        }),
      ).resolves.toBe(false);
    });

    it('limits subjects to the ones taught', async () => {
      const scope = build({ [P.ENROLLMENTS_READ]: RoleScope.ASSIGNED });

      await expect(
        scope.subjectAssignments(P.ENROLLMENTS_READ),
      ).resolves.toEqual(ASSIGNMENTS.subjects);
      await expect(
        scope.canAccessSubject(P.ENROLLMENTS_READ, {
          classId: 'c7',
          sectionId: 'sB',
          subjectId: 'math',
        }),
      ).resolves.toBe(true);
      await expect(
        scope.canAccessSubject(P.ENROLLMENTS_READ, {
          classId: 'c7',
          sectionId: 'sB',
          subjectId: 'english',
        }),
      ).resolves.toBe(false);
    });

    it('reaches nothing for a teacher with no assignments', async () => {
      teaching.activeAssignmentsForUser.mockResolvedValue({
        classSections: [],
        subjects: [],
      });
      const scope = build({ [P.STUDENTS_READ]: RoleScope.ASSIGNED });

      await expect(scope.can(P.STUDENTS_READ)).resolves.toBe(true);
      await expect(scope.sections(P.STUDENTS_READ)).resolves.toEqual([]);
    });

    it('reads roles and assignments once per request', async () => {
      const scope = build({
        [P.STUDENTS_READ]: RoleScope.ASSIGNED,
        [P.ENROLLMENTS_READ]: RoleScope.ASSIGNED,
      });

      await scope.sections(P.STUDENTS_READ);
      await scope.sections(P.ENROLLMENTS_READ);
      await scope.subjectAssignments(P.STUDENTS_READ);

      expect(resolver.getPermissionScopes).toHaveBeenCalledTimes(1);
      expect(teaching.activeAssignmentsForUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('mixed roles', () => {
    it('answers per key: school-wide for one, assigned for another', async () => {
      const scope = build({
        [P.STUDENTS_READ]: RoleScope.SCHOOL,
        [P.STUDENTS_UPDATE]: RoleScope.ASSIGNED,
      });

      await expect(scope.sections(P.STUDENTS_READ)).resolves.toBeNull();
      await expect(scope.sections(P.STUDENTS_UPDATE)).resolves.toHaveLength(3);
    });
  });

  describe('key not held', () => {
    it('denies and reaches nothing, without loading assignments', async () => {
      const scope = build({ [P.STUDENTS_READ]: RoleScope.SCHOOL });

      await expect(scope.can(P.STUDENTS_DELETE)).resolves.toBe(false);
      await expect(scope.sections(P.STUDENTS_DELETE)).resolves.toEqual([]);
      await expect(
        scope.subjectAssignments(P.STUDENTS_DELETE),
      ).resolves.toEqual([]);
      await expect(
        scope.canAccessSection(P.STUDENTS_DELETE, {
          classId: 'c6',
          sectionId: 'sA',
        }),
      ).resolves.toBe(false);
      expect(teaching.activeAssignmentsForUser).not.toHaveBeenCalled();
    });

    it('denies staff keys to a portal-only role', async () => {
      const scope = build({ [P.PORTAL_ACCESS]: RoleScope.SCHOOL });

      await expect(scope.can(P.STUDENTS_READ)).resolves.toBe(false);
      await expect(scope.can(P.PORTAL_ACCESS)).resolves.toBe(true);
    });
  });

  it('refuses to answer without an authenticated user', async () => {
    const scope = build({}, null);

    await expect(scope.can(P.STUDENTS_READ)).rejects.toThrow(
      'without an authenticated user',
    );
  });
});
