import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearRepository } from '../academic-years/academic-year.repository';
import { ClassRepository } from '../classes/class.repository';
import { ClassSubjectRepository } from '../class-curriculum/class-subject.repository';
import { SectionRepository } from '../sections/section.repository';
import { SubjectRepository } from '../subjects/subject.repository';
import { StudentService } from '../students/services/student.service';
import { EnrollmentRepository } from './enrollment.repository';
import { StudentSubjectRepository } from './student-subject.repository';
import { EnrollmentService } from './enrollment.service';
import { StudentEnrollment } from './entities/student-enrollment.entity';

const makeEnrollment = (
  overrides: Partial<StudentEnrollment> = {},
): StudentEnrollment =>
  ({
    id: 'enr-1',
    studentId: 'std-1',
    academicYearId: 'ay-1',
    classId: 'cls-1',
    sectionId: 'sec-1',
    rollNo: '1',
    status: 'active',
    subjects: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as StudentEnrollment;

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let enrollmentRepo: Record<string, jest.Mock>;
  let studentSubjectRepo: Record<string, jest.Mock>;
  let studentService: Record<string, jest.Mock>;
  let yearRepo: Record<string, jest.Mock>;
  let classRepo: Record<string, jest.Mock>;
  let sectionRepo: Record<string, jest.Mock>;
  let subjectRepo: Record<string, jest.Mock>;
  let classSubjectRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    enrollmentRepo = {
      findByIdWithRelations: jest.fn(),
      findForStudentYear: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeEnrollment({ id: 'new-enr', ...data })),
      ),
      save: jest.fn((e) => Promise.resolve(e)),
      deleteById: jest.fn(),
    };
    studentSubjectRepo = {
      findByEnrollment: jest.fn(),
      findLink: jest.fn(),
      findByIdWithSubject: jest.fn((id: string) =>
        Promise.resolve({ id, subjectId: 'sub-1' }),
      ),
      findByIdOrFail: jest.fn(),
      saveNew: jest.fn((data) => Promise.resolve({ id: 'new-link', ...data })),
      deleteById: jest.fn(),
    };
    studentService = { findById: jest.fn() };
    yearRepo = { findByIdOrFail: jest.fn() };
    classRepo = { findByIdOrFail: jest.fn() };
    sectionRepo = { findByIdOrFail: jest.fn() };
    subjectRepo = { findByIdOrFail: jest.fn() };
    classSubjectRepo = { findOfferedSubjectIds: jest.fn() };

    service = new EnrollmentService(
      enrollmentRepo as unknown as EnrollmentRepository,
      studentSubjectRepo as unknown as StudentSubjectRepository,
      studentService as unknown as StudentService,
      yearRepo as unknown as AcademicYearRepository,
      classRepo as unknown as ClassRepository,
      sectionRepo as unknown as SectionRepository,
      subjectRepo as unknown as SubjectRepository,
      classSubjectRepo as unknown as ClassSubjectRepository,
    );
  });

  describe('create', () => {
    it('rejects a duplicate enrollment for the same year', async () => {
      enrollmentRepo.findForStudentYear.mockResolvedValue(makeEnrollment());

      await expect(
        service.create({
          studentId: 'std-1',
          academicYearId: 'ay-1',
          classId: 'cls-1',
          sectionId: 'sec-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('selectSubject', () => {
    it('rejects a subject not offered to the class', async () => {
      enrollmentRepo.findByIdWithRelations.mockResolvedValue(makeEnrollment());
      classSubjectRepo.findOfferedSubjectIds.mockResolvedValue(['other-sub']);

      await expect(
        service.selectSubject('enr-1', { subjectId: 'sub-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('selects an offered subject', async () => {
      enrollmentRepo.findByIdWithRelations.mockResolvedValue(makeEnrollment());
      classSubjectRepo.findOfferedSubjectIds.mockResolvedValue(['sub-1']);
      studentSubjectRepo.findLink.mockResolvedValue(null);

      const link = await service.selectSubject('enr-1', { subjectId: 'sub-1' });

      expect(studentSubjectRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          studentEnrollmentId: 'enr-1',
          subjectId: 'sub-1',
        }),
      );
      expect(link.id).toBe('new-link');
    });

    it('rejects an already-selected subject', async () => {
      enrollmentRepo.findByIdWithRelations.mockResolvedValue(makeEnrollment());
      classSubjectRepo.findOfferedSubjectIds.mockResolvedValue(['sub-1']);
      studentSubjectRepo.findLink.mockResolvedValue({ id: 'x' });

      await expect(
        service.selectSubject('enr-1', { subjectId: 'sub-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deselectSubject', () => {
    it('rejects a selection from another enrollment', async () => {
      studentSubjectRepo.findByIdOrFail.mockResolvedValue({
        id: 'link-1',
        studentEnrollmentId: 'other',
      });

      await expect(service.deselectSubject('enr-1', 'link-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
