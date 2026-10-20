import {
  PERMISSIONS,
  PERMISSION_SET,
  PORTAL_PERMISSIONS,
  STAFF_PERMISSIONS,
} from './permissions.catalog';
import { RoleScope } from './enums/role-scope.enum';
import { SYSTEM_ROLES } from './system-roles.seed';

const role = (name: string) => {
  const found = SYSTEM_ROLES.find((r) => r.name === name);
  if (!found) throw new Error(`no system role ${name}`);
  return found;
};

describe('SYSTEM_ROLES', () => {
  it('has exactly the PRD 6.3 system roles', () => {
    expect(SYSTEM_ROLES.map((r) => r.name).sort()).toEqual(
      [
        'accountant',
        'admin',
        'class_teacher',
        'committee_member',
        'guardian',
        'librarian',
        'principal',
        'receptionist',
        'student',
        'teacher',
      ].sort(),
    );
  });

  it.each(SYSTEM_ROLES.map((r) => [r.name, r] as const))(
    '%s uses catalog keys only, without duplicates',
    (_name, r) => {
      expect(r.permissions.filter((p) => !PERMISSION_SET.has(p))).toEqual([]);
      expect(new Set(r.permissions).size).toBe(r.permissions.length);
    },
  );

  it('gives admin every staff key and no portal key', () => {
    expect([...role('admin').permissions].sort()).toEqual(
      [...STAFF_PERMISSIONS].sort(),
    );
  });

  it('limits teacher and class_teacher to assigned sections', () => {
    expect(role('teacher').scope).toBe(RoleScope.ASSIGNED);
    expect(role('class_teacher').scope).toBe(RoleScope.ASSIGNED);
    for (const r of SYSTEM_ROLES) {
      if (r.name !== 'teacher' && r.name !== 'class_teacher') {
        expect(r.scope).toBe(RoleScope.SCHOOL);
      }
    }
  });

  it('gives guardian and student portal keys only', () => {
    for (const name of ['guardian', 'student']) {
      expect(role(name).permissions).toEqual(PORTAL_PERMISSIONS);
    }
  });

  it('keeps portal keys off every staff role', () => {
    for (const r of SYSTEM_ROLES) {
      if (r.name === 'guardian' || r.name === 'student') continue;
      expect(r.permissions.filter((p) => p.startsWith('portal:'))).toEqual([]);
    }
  });

  it('keeps committee_member read-only and away from sensitive student data', () => {
    const perms = role('committee_member').permissions;
    expect(perms.filter((p) => !p.endsWith(':read'))).toEqual([]);
    expect(perms).not.toContain(PERMISSIONS.STUDENT_MEDICAL_READ);
    expect(perms).not.toContain(PERMISSIONS.STUDENT_NOTES_READ);
    expect(perms).not.toContain(PERMISSIONS.GUARDIANS_READ);
    expect(perms).not.toContain(PERMISSIONS.STUDENTS_READ);
  });

  it('keeps the dormant timetable out of every role but admin', () => {
    for (const r of SYSTEM_ROLES) {
      if (r.name === 'admin') continue;
      expect(
        r.permissions.filter(
          (p) => p.startsWith('timetables:') || p.startsWith('periods:'),
        ),
      ).toEqual([]);
    }
  });

  it('reserves users and roles management for admin', () => {
    for (const r of SYSTEM_ROLES) {
      if (r.name === 'admin') continue;
      expect(
        r.permissions.filter(
          (p) => p.startsWith('users:') || p.startsWith('roles:'),
        ),
      ).toEqual([]);
    }
  });
});
