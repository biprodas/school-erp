import { ConflictException } from '@nestjs/common';
import { AcademicYearRepository } from '../academic-years/academic-year.repository';
import { ClassRepository } from '../classes/class.repository';
import { EmployeeService } from '../employees/employee.service';
import { SectionRepository } from '../sections/section.repository';
import { ClassTeacherRepository } from './class-teacher.repository';
import { ClassTeacherService } from './class-teacher.service';
import { ClassTeacher } from './entities/class-teacher.entity';

const makeCT = (overrides: Partial<ClassTeacher> = {}): ClassTeacher =>
  ({
    id: 'ct-1',
    classId: 'cls-1',
    sectionId: 'sec-1',
    employeeId: 'emp-1',
    academicYearId: 'ay-1',
    isPrimary: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ClassTeacher;

describe('ClassTeacherService', () => {
  let service: ClassTeacherService;
  let repo: Record<string, jest.Mock>;
  let classRepo: Record<string, jest.Mock>;
  let sectionRepo: Record<string, jest.Mock>;
  let yearRepo: Record<string, jest.Mock>;
  let employeeService: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      findByIdWithRelations: jest.fn(),
      findLink: jest.fn(),
      clearPrimary: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeCT({ id: 'new-ct', ...data })),
      ),
      save: jest.fn((e) => Promise.resolve(e)),
      deleteById: jest.fn(),
    };
    classRepo = { findByIdOrFail: jest.fn() };
    sectionRepo = { findByIdOrFail: jest.fn() };
    yearRepo = { findByIdOrFail: jest.fn() };
    employeeService = { findById: jest.fn() };

    service = new ClassTeacherService(
      repo as unknown as ClassTeacherRepository,
      classRepo as unknown as ClassRepository,
      sectionRepo as unknown as SectionRepository,
      yearRepo as unknown as AcademicYearRepository,
      employeeService as unknown as EmployeeService,
    );
  });

  it('clears other primaries when assigning a primary class teacher', async () => {
    repo.findLink.mockResolvedValue(null);
    repo.findByIdWithRelations.mockResolvedValue(makeCT({ id: 'new-ct' }));

    await service.create({
      classId: 'cls-1',
      sectionId: 'sec-1',
      employeeId: 'emp-1',
      academicYearId: 'ay-1',
      isPrimary: true,
    });

    expect(repo.clearPrimary).toHaveBeenCalledWith('ay-1', 'cls-1', 'sec-1');
  });

  it('rejects a duplicate assignment', async () => {
    repo.findLink.mockResolvedValue(makeCT());

    await expect(
      service.create({
        classId: 'cls-1',
        sectionId: 'sec-1',
        employeeId: 'emp-1',
        academicYearId: 'ay-1',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
