import { TeachingService } from './teaching.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { ClassTeacherRepository } from '../repositories/class-teacher.repository';
import { SubjectTeacherRepository } from '../repositories/subject-teacher.repository';

describe('TeachingService', () => {
  let service: TeachingService;
  let classTeacherRepo: Record<string, jest.Mock>;
  let subjectTeacherRepo: Record<string, jest.Mock>;
  let employeeService: { findByUserId: jest.Mock };
  let settings: { today: jest.Mock };

  beforeEach(() => {
    classTeacherRepo = {
      findActiveForEmployee: jest.fn().mockResolvedValue([]),
      findCurrentInYear: jest.fn().mockResolvedValue([]),
      findCurrent: jest.fn().mockResolvedValue(null),
      findCurrentPrimary: jest.fn().mockResolvedValue(null),
      saveNew: jest.fn(),
    };
    subjectTeacherRepo = {
      findActiveForEmployee: jest.fn().mockResolvedValue([]),
      findActiveFor: jest.fn().mockResolvedValue([]),
      findCurrentInYear: jest.fn().mockResolvedValue([]),
      findCurrent: jest.fn().mockResolvedValue(null),
      saveNew: jest.fn(),
    };
    employeeService = {
      findByUserId: jest.fn().mockResolvedValue({ id: 'emp-1' }),
    };
    settings = { today: jest.fn().mockResolvedValue('2026-03-15') };
    service = new TeachingService(
      classTeacherRepo as unknown as ClassTeacherRepository,
      subjectTeacherRepo as unknown as SubjectTeacherRepository,
      employeeService as unknown as EmployeeService,
      settings as unknown as SettingsService,
    );
  });

  it("returns the employee's assignments in effect today", async () => {
    classTeacherRepo.findActiveForEmployee.mockResolvedValue([
      { id: 'ct', sectionId: 'sA', isPrimary: true },
    ]);
    subjectTeacherRepo.findActiveForEmployee.mockResolvedValue([
      { id: 'st', sectionId: 'sB', classSubjectId: 'math' },
    ]);

    await expect(service.activeAssignmentsForUser('u1')).resolves.toEqual({
      sections: ['sA'],
      subjects: [{ sectionId: 'sB', classSubjectId: 'math' }],
    });
    expect(employeeService.findByUserId).toHaveBeenCalledWith('u1');
    expect(classTeacherRepo.findActiveForEmployee).toHaveBeenCalledWith(
      'emp-1',
      '2026-03-15',
    );
    expect(subjectTeacherRepo.findActiveForEmployee).toHaveBeenCalledWith(
      'emp-1',
      '2026-03-15',
    );
  });

  it('returns nothing for a user without an employee record', async () => {
    employeeService.findByUserId.mockResolvedValue(null);

    await expect(service.activeAssignmentsForUser('u1')).resolves.toEqual({
      sections: [],
      subjects: [],
    });
    expect(classTeacherRepo.findActiveForEmployee).not.toHaveBeenCalled();
  });

  it('answers who taught a subject on a past day', async () => {
    const rows = [{ employeeId: 'emp-old' }];
    subjectTeacherRepo.findActiveFor.mockResolvedValue(rows);

    await expect(
      service.assignmentOn('sA', 'math', '2026-02-01'),
    ).resolves.toBe(rows);
    expect(subjectTeacherRepo.findActiveFor).toHaveBeenCalledWith(
      'sA',
      'math',
      '2026-02-01',
    );
  });

  describe('copyToYear', () => {
    const active = { status: 'active' };

    it('opens copies from the new first day, skipping what has no target', async () => {
      classTeacherRepo.findCurrentInYear.mockResolvedValue([
        { sectionId: 'a', employeeId: 'e1', isPrimary: true, employee: active },
        {
          sectionId: 'gone',
          employeeId: 'e2',
          isPrimary: false,
          employee: active,
        },
        {
          sectionId: 'a',
          employeeId: 'e3',
          isPrimary: false,
          employee: { status: 'terminated' },
        },
      ]);
      subjectTeacherRepo.findCurrentInYear.mockResolvedValue([
        {
          sectionId: 'a',
          classSubjectId: 'm',
          employeeId: 'e1',
          employee: active,
        },
        {
          sectionId: 'a',
          classSubjectId: 'x',
          employeeId: 'e1',
          employee: active,
        },
      ]);

      const result = await service.copyToYear({
        fromYearId: 'from',
        sectionIds: new Map([['a', 'A2']]),
        classSubjectIds: new Map([['m', 'M2']]),
        effectiveFrom: '2027-01-01',
      });

      expect(result).toEqual({
        classTeachers: { created: 1, skipped: 2 },
        subjectTeachers: { created: 1, skipped: 1 },
      });
      expect(classTeacherRepo.saveNew).toHaveBeenCalledWith({
        sectionId: 'A2',
        employeeId: 'e1',
        isPrimary: true,
        effectiveFrom: '2027-01-01',
        effectiveTo: null,
      });
      expect(subjectTeacherRepo.saveNew).toHaveBeenCalledWith({
        sectionId: 'A2',
        classSubjectId: 'M2',
        employeeId: 'e1',
        effectiveFrom: '2027-01-01',
        effectiveTo: null,
      });
    });

    it('keeps an existing primary and skips existing assignments', async () => {
      classTeacherRepo.findCurrentInYear.mockResolvedValue([
        { sectionId: 'a', employeeId: 'e1', isPrimary: true, employee: active },
        {
          sectionId: 'a',
          employeeId: 'e2',
          isPrimary: false,
          employee: active,
        },
      ]);
      classTeacherRepo.findCurrentPrimary.mockResolvedValue({ id: 'p' });
      classTeacherRepo.findCurrent.mockImplementation((_s: string, e: string) =>
        Promise.resolve(e === 'e2' ? { id: 'existing' } : null),
      );

      const result = await service.copyToYear({
        fromYearId: 'from',
        sectionIds: new Map([['a', 'A2']]),
        classSubjectIds: new Map(),
        effectiveFrom: '2027-01-01',
      });

      expect(result.classTeachers).toEqual({ created: 1, skipped: 1 });
      expect(classTeacherRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'e1', isPrimary: false }),
      );
    });
  });
});
