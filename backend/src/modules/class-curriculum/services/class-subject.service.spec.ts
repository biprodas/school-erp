import { ConflictException, NotFoundException } from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/services/class.service';
import { SubjectService } from '~/modules/subjects/subject.service';
import { ClassSubjectRepository } from '../repositories/class-subject.repository';
import { ClassSubjectService } from './class-subject.service';
import { ClassSubject } from '../entities/class-subject.entity';

const makeCS = (overrides: Partial<ClassSubject> = {}): ClassSubject =>
  ({
    id: 'cs-1',
    classId: 'cls-1',
    subjectId: 'sub-1',
    academicYearId: 'ay-1',
    isCompulsory: true,
    weeklyClasses: null,
    passMarks: null,
    fullMarks: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ClassSubject;

describe('ClassSubjectService', () => {
  let service: ClassSubjectService;
  let repo: Record<string, jest.Mock>;
  let classRepo: Record<string, jest.Mock>;
  let subjectRepo: Record<string, jest.Mock>;
  let yearRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      findByIdWithRelations: jest.fn(),
      findLink: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data: Partial<ClassSubject>) =>
        Promise.resolve(makeCS({ id: 'new-cs', ...data })),
      ),
      save: jest.fn((e) => Promise.resolve(e)),
      deleteById: jest.fn(),
    };
    classRepo = { findById: jest.fn() };
    subjectRepo = { findById: jest.fn() };
    yearRepo = { findById: jest.fn() };

    service = new ClassSubjectService(
      repo as unknown as ClassSubjectRepository,
      classRepo as unknown as ClassService,
      subjectRepo as unknown as SubjectService,
      yearRepo as unknown as AcademicYearService,
    );
  });

  it('creates an offering after validating FKs', async () => {
    repo.findLink.mockResolvedValue(null);
    repo.findByIdWithRelations.mockResolvedValue(makeCS({ id: 'new-cs' }));

    const result = await service.create({
      classId: 'cls-1',
      subjectId: 'sub-1',
      academicYearId: 'ay-1',
    });

    expect(classRepo.findById).toHaveBeenCalledWith('cls-1');
    expect(subjectRepo.findById).toHaveBeenCalledWith('sub-1');
    expect(yearRepo.findById).toHaveBeenCalledWith('ay-1');
    expect(result.id).toBe('new-cs');
  });

  it('rejects a duplicate offering', async () => {
    repo.findLink.mockResolvedValue(makeCS());

    await expect(
      service.create({
        classId: 'cls-1',
        subjectId: 'sub-1',
        academicYearId: 'ay-1',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('propagates not-found on remove', async () => {
    repo.findByIdWithRelations.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});
