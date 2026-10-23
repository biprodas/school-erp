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

/**
 * Class teacher of 6A; Math in 7A and 7B (class subject `math7`) and in
 * 6A (`math6`). Sections are per class and session, so ids are distinct.
 */
const ASSIGNMENTS: TeachingAssignments = {
  sections: ['s6A'],
  subjects: [
    { sectionId: 's7A', classSubjectId: 'math7' },
    { sectionId: 's7B', classSubjectId: 'math7' },
    { sectionId: 's6A', classSubjectId: 'math6' },
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

      await expect(scope.sections(P.STUDENTS_READ)).resolves.toBeNull();
      await expect(
        scope.canAccessSection(P.STUDENTS_READ, 's9Z'),
      ).resolves.toBe(true);
      expect(teaching.activeAssignmentsForUser).not.toHaveBeenCalled();
    });
  });

  describe('assigned role', () => {
    it('reaches class-teacher and subject-teacher sections, once each', async () => {
      const scope = build({ [P.STUDENTS_READ]: RoleScope.ASSIGNED });

      const sections = await scope.sections(P.STUDENTS_READ);

      expect(sections).toHaveLength(3);
      expect(sections).toEqual(expect.arrayContaining(['s6A', 's7A', 's7B']));
      expect(teaching.activeAssignmentsForUser).toHaveBeenCalledWith('u1');
    });

    it('checks one section by id', async () => {
      const scope = build({ [P.STUDENTS_READ]: RoleScope.ASSIGNED });

      await expect(
        scope.canAccessSection(P.STUDENTS_READ, 's6A'),
      ).resolves.toBe(true);
      await expect(
        scope.canAccessSection(P.STUDENTS_READ, 's8A'),
      ).resolves.toBe(false);
    });

    it('limits subjects to the ones taught', async () => {
      const scope = build({ [P.ENROLLMENTS_READ]: RoleScope.ASSIGNED });

      await expect(
        scope.subjectAssignments(P.ENROLLMENTS_READ),
      ).resolves.toEqual(ASSIGNMENTS.subjects);
      await expect(
        scope.canAccessSubject(P.ENROLLMENTS_READ, {
          sectionId: 's7B',
          classSubjectId: 'math7',
        }),
      ).resolves.toBe(true);
      await expect(
        scope.canAccessSubject(P.ENROLLMENTS_READ, {
          sectionId: 's7B',
          classSubjectId: 'english7',
        }),
      ).resolves.toBe(false);
      // The subject taught elsewhere doesn't open this section's.
      await expect(
        scope.canAccessSubject(P.ENROLLMENTS_READ, {
          sectionId: 's7B',
          classSubjectId: 'math6',
        }),
      ).resolves.toBe(false);
    });

    it('reaches nothing for a teacher with no assignments', async () => {
      teaching.activeAssignmentsForUser.mockResolvedValue({
        sections: [],
        subjects: [],
      });
      const scope = build({ [P.STUDENTS_READ]: RoleScope.ASSIGNED });

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

      await expect(scope.sections(P.STUDENTS_DELETE)).resolves.toEqual([]);
      await expect(
        scope.subjectAssignments(P.STUDENTS_DELETE),
      ).resolves.toEqual([]);
      await expect(
        scope.canAccessSection(P.STUDENTS_DELETE, 's6A'),
      ).resolves.toBe(false);
      expect(teaching.activeAssignmentsForUser).not.toHaveBeenCalled();
    });

    it('reaches no section with staff keys for a portal-only role', async () => {
      const scope = build({ [P.PORTAL_ACCESS]: RoleScope.SCHOOL });

      await expect(scope.sections(P.STUDENTS_READ)).resolves.toEqual([]);
      await expect(scope.sections(P.PORTAL_ACCESS)).resolves.toBeNull();
    });
  });

  it('refuses to answer without an authenticated user', async () => {
    const scope = build({}, null);

    await expect(scope.sections(P.STUDENTS_READ)).rejects.toThrow(
      'without an authenticated user',
    );
  });
});
