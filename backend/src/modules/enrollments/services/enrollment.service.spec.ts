import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { ClassSubjectGroupService } from '~/modules/class-curriculum/services/class-subject-group.service';
import { ClassSubjectType } from '~/modules/class-curriculum/enums/class-subject-type.enum';
import { SectionService } from '~/modules/sections/section.service';
import { SubjectService } from '~/modules/subjects/subject.service';
import { StudentService } from '~/modules/students/services/student.service';
import { EnrollmentRepository } from '../repositories/enrollment.repository';
import { StudentSubjectRepository } from '../repositories/student-subject.repository';
import { EnrollmentService } from './enrollment.service';
import { StudentEnrollment } from '../entities/student-enrollment.entity';

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
  let groupRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    enrollmentRepo = {
      findByIdWithRelations: jest.fn(),
      findForStudentYear: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data: Partial<StudentEnrollment>) =>
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
      findFourthSubject: jest.fn().mockResolvedValue(null),
      saveNew: jest.fn((data) => Promise.resolve({ id: 'new-link', ...data })),
      deleteById: jest.fn(),
    };
    studentService = { findById: jest.fn() };
    yearRepo = { findById: jest.fn() };
    classRepo = { findById: jest.fn() };
    sectionRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'sec-1',
        classId: 'cls-1',
        academicYearId: 'ay-1',
      }),
    };
    subjectRepo = { findById: jest.fn() };
    classSubjectRepo = { findOffered: jest.fn() };
    groupRepo = { isOffered: jest.fn().mockResolvedValue(true) };

    service = new EnrollmentService(
      enrollmentRepo as unknown as EnrollmentRepository,
      studentSubjectRepo as unknown as StudentSubjectRepository,
      studentService as unknown as StudentService,
      yearRepo as unknown as AcademicYearService,
      classRepo as unknown as ClassService,
      sectionRepo as unknown as SectionService,
      subjectRepo as unknown as SubjectService,
      classSubjectRepo as unknown as ClassSubjectService,
      groupRepo as unknown as ClassSubjectGroupService,
    );
  });

  describe('create', () => {
    it('rejects a section of another class or session', async () => {
      sectionRepo.findById.mockResolvedValue({
        id: 'sec-9',
        classId: 'cls-1',
        academicYearId: 'ay-old',
      });

      await expect(
        service.create({
          studentId: 'std-1',
          academicYearId: 'ay-1',
          classId: 'cls-1',
          sectionId: 'sec-9',
        }),
      ).rejects.toMatchObject({ response: { code: 'SECTION_NOT_IN_CLASS' } });
      expect(enrollmentRepo.saveNew).not.toHaveBeenCalled();
    });

    it('rejects a group the class does not offer', async () => {
      groupRepo.isOffered.mockResolvedValue(false);

      await expect(
        service.create({
          studentId: 'std-1',
          academicYearId: 'ay-1',
          classId: 'cls-1',
          sectionId: 'sec-1',
          subjectGroupId: 'science',
        }),
      ).rejects.toMatchObject({ response: { code: 'GROUP_NOT_OFFERED' } });
    });

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
      classSubjectRepo.findOffered.mockResolvedValue(null);

      await expect(
        service.selectSubject('enr-1', { subjectId: 'sub-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('selects an offered subject', async () => {
      enrollmentRepo.findByIdWithRelations.mockResolvedValue(makeEnrollment());
      classSubjectRepo.findOffered.mockResolvedValue({
        subjectType: ClassSubjectType.OPTIONAL,
      });
      studentSubjectRepo.findLink.mockResolvedValue(null);

      const link = await service.selectSubject('enr-1', { subjectId: 'sub-1' });

      expect(studentSubjectRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          studentEnrollmentId: 'enr-1',
          subjectId: 'sub-1',
          isFourthSubject: false,
        }),
      );
      expect(link.id).toBe('new-link');
    });

    it('takes a 4th subject only from fourth/optional class subjects', async () => {
      enrollmentRepo.findByIdWithRelations.mockResolvedValue(makeEnrollment());
      studentSubjectRepo.findLink.mockResolvedValue(null);
      classSubjectRepo.findOffered.mockResolvedValue({
        subjectType: ClassSubjectType.COMPULSORY,
      });

      await expect(
        service.selectSubject('enr-1', {
          subjectId: 'sub-1',
          isFourthSubject: true,
        }),
      ).rejects.toMatchObject({ response: { code: 'NOT_A_FOURTH_SUBJECT' } });

      classSubjectRepo.findOffered.mockResolvedValue({
        subjectType: ClassSubjectType.FOURTH,
      });
      await service.selectSubject('enr-1', {
        subjectId: 'sub-1',
        isFourthSubject: true,
      });
      expect(studentSubjectRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ isFourthSubject: true }),
      );
    });

    it('allows at most one 4th subject', async () => {
      enrollmentRepo.findByIdWithRelations.mockResolvedValue(makeEnrollment());
      classSubjectRepo.findOffered.mockResolvedValue({
        subjectType: ClassSubjectType.FOURTH,
      });
      studentSubjectRepo.findFourthSubject.mockResolvedValue({ id: 'bio' });

      await expect(
        service.selectSubject('enr-1', {
          subjectId: 'sub-1',
          isFourthSubject: true,
        }),
      ).rejects.toMatchObject({ response: { code: 'FOURTH_SUBJECT_TAKEN' } });
    });

    it('rejects an already-selected subject', async () => {
      enrollmentRepo.findByIdWithRelations.mockResolvedValue(makeEnrollment());
      classSubjectRepo.findOffered.mockResolvedValue({
        subjectType: ClassSubjectType.COMPULSORY,
      });
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
