import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { SubjectService } from '~/modules/subjects/subject.service';
import { SubjectGroupService } from '~/modules/subject-groups/services/subject-group.service';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { ClassSubjectRepository } from '../repositories/class-subject.repository';
import { ClassSubjectComponentRepository } from '../repositories/class-subject-component.repository';
import { ClassSubject } from '../entities/class-subject.entity';
import { ClassSubjectComponent } from '../entities/class-subject-component.entity';
import { ClassSubjectType } from '../enums/class-subject-type.enum';
import { SubjectComponent } from '../enums/subject-component.enum';
import { ClassSubjectComponentService } from './class-subject-component.service';
import { ClassSubjectService } from './class-subject.service';

const makeCS = (overrides: Partial<ClassSubject> = {}): ClassSubject =>
  ({
    id: 'cs-1',
    classId: 'cls-1',
    subjectId: 'sub-1',
    academicYearId: 'ay-1',
    subjectType: ClassSubjectType.COMPULSORY,
    subjectGroupId: null,
    weeklyClasses: null,
    passMarks: null,
    fullMarks: null,
    components: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ClassSubject;

describe('ClassSubjectService', () => {
  let service: ClassSubjectService;
  let repo: Record<string, jest.Mock>;
  let componentRepo: Record<string, jest.Mock>;
  let classRepo: Record<string, jest.Mock>;
  let subjectRepo: Record<string, jest.Mock>;
  let groupService: Record<string, jest.Mock>;
  let yearRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      findByIdWithRelations: jest.fn((id: string) =>
        Promise.resolve(makeCS({ id })),
      ),
      findLink: jest.fn().mockResolvedValue(null),
      findFiltered: jest.fn(),
      findInYear: jest.fn().mockResolvedValue([]),
      saveNew: jest.fn((data: Partial<ClassSubject>) =>
        Promise.resolve(makeCS({ id: 'new-cs', ...data })),
      ),
      updateFields: jest.fn(),
      deleteById: jest.fn(),
    };
    componentRepo = {
      findByComponent: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      saveNew: jest.fn((data: Partial<ClassSubjectComponent>) =>
        Promise.resolve({ id: 'comp', ...data }),
      ),
      save: jest.fn((e) => Promise.resolve(e)),
    };
    classRepo = { findById: jest.fn() };
    subjectRepo = { findById: jest.fn() };
    groupService = { findById: jest.fn() };
    yearRepo = { findById: jest.fn() };

    service = new ClassSubjectService(
      repo as unknown as ClassSubjectRepository,
      new ClassSubjectComponentService(
        componentRepo as unknown as ClassSubjectComponentRepository,
      ),
      classRepo as unknown as ClassService,
      subjectRepo as unknown as SubjectService,
      groupService as unknown as SubjectGroupService,
      yearRepo as unknown as AcademicYearService,
      fakeTenantDataSource(),
    );
  });

  it('creates an offering after validating FKs', async () => {
    const result = await service.create({
      classId: 'cls-1',
      subjectId: 'sub-1',
      academicYearId: 'ay-1',
      subjectType: ClassSubjectType.FOURTH,
      subjectGroupId: 'grp-1',
    });

    expect(classRepo.findById).toHaveBeenCalledWith('cls-1');
    expect(subjectRepo.findById).toHaveBeenCalledWith('sub-1');
    expect(yearRepo.findById).toHaveBeenCalledWith('ay-1');
    expect(groupService.findById).toHaveBeenCalledWith('grp-1');
    expect(repo.saveNew).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectType: ClassSubjectType.FOURTH,
        subjectGroupId: 'grp-1',
        fullMarks: null,
      }),
    );
    expect(result.id).toBe('new-cs');
  });

  it('creates components with the subject and totals their marks', async () => {
    await service.create({
      classId: 'cls-1',
      subjectId: 'sub-1',
      academicYearId: 'ay-1',
      components: [
        { component: SubjectComponent.CQ, fullMarks: 70, passMarks: 23 },
        { component: SubjectComponent.MCQ, fullMarks: 30, passMarks: 10 },
      ],
    });

    expect(repo.saveNew).toHaveBeenCalledWith(
      expect.objectContaining({ fullMarks: 100 }),
    );
    expect(componentRepo.saveNew).toHaveBeenNthCalledWith(1, {
      classSubjectId: 'new-cs',
      component: SubjectComponent.CQ,
      fullMarks: 70,
      passMarks: 23,
      sortOrder: 0,
    });
    expect(componentRepo.saveNew).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        component: SubjectComponent.MCQ,
        sortOrder: 1,
      }),
    );
  });

  it('rejects pass marks above full marks', async () => {
    await expect(
      service.addComponent('cs-1', {
        component: SubjectComponent.PRACTICAL,
        fullMarks: 25,
        passMarks: 30,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a second component of the same kind', async () => {
    componentRepo.findByComponent.mockResolvedValue({ id: 'existing' });

    await expect(
      service.addComponent('cs-1', {
        component: SubjectComponent.CQ,
        fullMarks: 70,
      }),
    ).rejects.toMatchObject({ response: { code: 'COMPONENT_EXISTS' } });
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

  it('copies a session with components, skipping existing ones on merge', async () => {
    const math = makeCS({
      id: 'math',
      subjectId: 'm',
      components: [
        {
          component: SubjectComponent.CQ,
          fullMarks: 70,
          passMarks: 23,
          sortOrder: 0,
        } as ClassSubjectComponent,
      ],
    });
    const bangla = makeCS({ id: 'bangla', subjectId: 'b' });
    repo.findInYear.mockImplementation((year: string) =>
      Promise.resolve(
        year === 'from'
          ? [math, bangla]
          : [makeCS({ id: 'old-bangla', subjectId: 'b' })],
      ),
    );

    await expect(service.copyToYear('from', 'to', false)).rejects.toThrow(
      ConflictException,
    );

    repo.saveNew.mockClear();
    const result = await service.copyToYear('from', 'to', true);
    expect(result).toMatchObject({ created: 1, skipped: 1 });
    expect(result.ids.get('bangla')).toBe('old-bangla');
    expect(repo.saveNew).toHaveBeenCalledWith(
      expect.objectContaining({ academicYearId: 'to', subjectId: 'm' }),
    );
    expect(componentRepo.saveNew).toHaveBeenCalledWith(
      expect.objectContaining({ classSubjectId: 'new-cs', fullMarks: 70 }),
    );
  });

  it('checks a class subject belongs to a section', () => {
    const cs = makeCS({ classId: 'c6', academicYearId: 'y1' });

    expect(() =>
      service.assertInSection(cs, { classId: 'c6', academicYearId: 'y1' }),
    ).not.toThrow();
    expect(() =>
      service.assertInSection(cs, { classId: 'c7', academicYearId: 'y1' }),
    ).toThrow(BadRequestException);
  });
});
