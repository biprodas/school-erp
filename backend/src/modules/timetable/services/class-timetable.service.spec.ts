import { ConflictException } from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { SectionService } from '~/modules/sections/section.service';
import { SubjectService } from '~/modules/subjects/subject.service';
import { ClassTimetableRepository } from '../repositories/class-timetable.repository';
import { ClassTimetableService } from './class-timetable.service';
import { PeriodRepository } from '../repositories/period.repository';
import { ClassTimetable } from '../entities/class-timetable.entity';
import { DayOfWeek } from '../enums/day-of-week.enum';

const makeEntry = (overrides: Partial<ClassTimetable> = {}): ClassTimetable =>
  ({
    id: 'tt-1',
    academicYearId: 'ay-1',
    classId: 'cls-1',
    sectionId: 'sec-1',
    dayOfWeek: DayOfWeek.MONDAY,
    periodId: 'per-1',
    subjectId: 'sub-1',
    employeeId: 'emp-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ClassTimetable;

describe('ClassTimetableService', () => {
  let service: ClassTimetableService;
  let repo: Record<string, jest.Mock>;
  let deps: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      findByIdWithRelations: jest.fn(),
      findSlot: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data: Partial<ClassTimetable>) =>
        Promise.resolve(makeEntry({ id: 'new-tt', ...data })),
      ),
      save: jest.fn((e) => Promise.resolve(e)),
      deleteById: jest.fn(),
    };
    // Every lookup succeeds; a section answers with its class and year.
    deps = {
      findByIdOrFail: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        classId: 'cls-1',
        academicYearId: 'ay-1',
      }),
    };

    service = new ClassTimetableService(
      repo as unknown as ClassTimetableRepository,
      deps as unknown as PeriodRepository,
      deps as unknown as ClassService,
      deps as unknown as SectionService,
      deps as unknown as SubjectService,
      deps as unknown as AcademicYearService,
      deps as unknown as EmployeeService,
    );
  });

  it('creates a slot when free', async () => {
    repo.findSlot.mockResolvedValue(null);
    repo.findByIdWithRelations.mockResolvedValue(makeEntry({ id: 'new-tt' }));

    const result = await service.create({
      academicYearId: 'ay-1',
      classId: 'cls-1',
      sectionId: 'sec-1',
      dayOfWeek: DayOfWeek.MONDAY,
      periodId: 'per-1',
      subjectId: 'sub-1',
      employeeId: 'emp-1',
    });

    expect(result.id).toBe('new-tt');
  });

  it('rejects a double-booked slot', async () => {
    repo.findSlot.mockResolvedValue(makeEntry());

    await expect(
      service.create({
        academicYearId: 'ay-1',
        classId: 'cls-1',
        sectionId: 'sec-1',
        dayOfWeek: DayOfWeek.MONDAY,
        periodId: 'per-1',
        subjectId: 'sub-1',
        employeeId: 'emp-1',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
