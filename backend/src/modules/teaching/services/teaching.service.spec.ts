import { TeachingService } from './teaching.service';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { ClassTeacherRepository } from '../repositories/class-teacher.repository';
import { SubjectTeacherRepository } from '../repositories/subject-teacher.repository';

describe('TeachingService', () => {
  let service: TeachingService;
  let classTeacherRepo: { findByEmployee: jest.Mock };
  let subjectTeacherRepo: { findByEmployee: jest.Mock };
  let employeeService: { findByUserId: jest.Mock };
  let academicYearService: { findCurrent: jest.Mock };

  beforeEach(() => {
    classTeacherRepo = { findByEmployee: jest.fn().mockResolvedValue([]) };
    subjectTeacherRepo = { findByEmployee: jest.fn().mockResolvedValue([]) };
    employeeService = {
      findByUserId: jest.fn().mockResolvedValue({ id: 'emp-1' }),
    };
    academicYearService = {
      findCurrent: jest.fn().mockResolvedValue({ id: 'year-1' }),
    };
    service = new TeachingService(
      classTeacherRepo as unknown as ClassTeacherRepository,
      subjectTeacherRepo as unknown as SubjectTeacherRepository,
      employeeService as unknown as EmployeeService,
      academicYearService as unknown as AcademicYearService,
    );
  });

  it("returns the employee's current-session assignments", async () => {
    classTeacherRepo.findByEmployee.mockResolvedValue([
      { id: 'ct', classId: 'c6', sectionId: 'sA', isPrimary: true },
    ]);
    subjectTeacherRepo.findByEmployee.mockResolvedValue([
      { id: 'st', classId: 'c7', sectionId: 'sB', subjectId: 'math' },
    ]);

    await expect(service.activeAssignmentsForUser('u1')).resolves.toEqual({
      classSections: [{ classId: 'c6', sectionId: 'sA' }],
      subjects: [{ classId: 'c7', sectionId: 'sB', subjectId: 'math' }],
    });
    expect(employeeService.findByUserId).toHaveBeenCalledWith('u1');
    expect(classTeacherRepo.findByEmployee).toHaveBeenCalledWith(
      'emp-1',
      'year-1',
    );
    expect(subjectTeacherRepo.findByEmployee).toHaveBeenCalledWith(
      'emp-1',
      'year-1',
    );
  });

  it('returns nothing for a user without an employee record', async () => {
    employeeService.findByUserId.mockResolvedValue(null);

    await expect(service.activeAssignmentsForUser('u1')).resolves.toEqual({
      classSections: [],
      subjects: [],
    });
    expect(classTeacherRepo.findByEmployee).not.toHaveBeenCalled();
  });

  it('returns nothing when no academic year is current', async () => {
    academicYearService.findCurrent.mockResolvedValue(null);

    await expect(service.activeAssignmentsForUser('u1')).resolves.toEqual({
      classSections: [],
      subjects: [],
    });
    expect(subjectTeacherRepo.findByEmployee).not.toHaveBeenCalled();
  });

  it('returns a fresh empty result each time', async () => {
    employeeService.findByUserId.mockResolvedValue(null);

    const first = await service.activeAssignmentsForUser('u1');
    first.subjects.push({ classId: 'c', sectionId: 's', subjectId: 'x' });

    await expect(service.activeAssignmentsForUser('u1')).resolves.toEqual({
      classSections: [],
      subjects: [],
    });
  });
});
