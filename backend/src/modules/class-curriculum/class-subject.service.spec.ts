import { ConflictException, NotFoundException } from '@nestjs/common';
import { AcademicYearRepository } from '../academic-years/academic-year.repository';
import { ClassRepository } from '../classes/class.repository';
import { SubjectRepository } from '../subjects/subject.repository';
import { ClassSubjectRepository } from './class-subject.repository';
import { ClassSubjectService } from './class-subject.service';
import { ClassSubject } from './entities/class-subject.entity';

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
      saveNew: jest.fn((data) =>
        Promise.resolve(makeCS({ id: 'new-cs', ...data })),
      ),
      save: jest.fn((e) => Promise.resolve(e)),
      deleteById: jest.fn(),
    };
    classRepo = { findByIdOrFail: jest.fn() };
    subjectRepo = { findByIdOrFail: jest.fn() };
    yearRepo = { findByIdOrFail: jest.fn() };

    service = new ClassSubjectService(
      repo as unknown as ClassSubjectRepository,
      classRepo as unknown as ClassRepository,
      subjectRepo as unknown as SubjectRepository,
      yearRepo as unknown as AcademicYearRepository,
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

    expect(classRepo.findByIdOrFail).toHaveBeenCalledWith('cls-1');
    expect(subjectRepo.findByIdOrFail).toHaveBeenCalledWith('sub-1');
    expect(yearRepo.findByIdOrFail).toHaveBeenCalledWith('ay-1');
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
