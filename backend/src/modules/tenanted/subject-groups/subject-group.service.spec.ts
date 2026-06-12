import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubjectRepository } from '../subjects/subject.repository';
import { SubjectGroupRepository } from './subject-group.repository';
import { SubjectGroupSubjectRepository } from './subject-group-subject.repository';
import { SubjectGroupService } from './subject-group.service';
import { SubjectGroup } from './entities/subject-group.entity';
import { SubjectGroupSubject } from './entities/subject-group-subject.entity';

const makeGroup = (overrides: Partial<SubjectGroup> = {}): SubjectGroup => ({
  id: 'sg-1',
  name: 'Science',
  code: null,
  description: null,
  isActive: true,
  subjectLinks: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeLink = (
  overrides: Partial<SubjectGroupSubject> = {},
): SubjectGroupSubject =>
  ({
    id: 'link-1',
    subjectGroupId: 'sg-1',
    subjectId: 'sub-1',
    isCompulsory: true,
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as SubjectGroupSubject;

describe('SubjectGroupService', () => {
  let service: SubjectGroupService;
  let groupRepo: Record<string, jest.Mock>;
  let linkRepo: Record<string, jest.Mock>;
  let subjectRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    groupRepo = {
      findByName: jest.fn(),
      findByIdWithSubjects: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeGroup({ id: 'new-sg', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };
    linkRepo = {
      findByGroup: jest.fn(),
      findLink: jest.fn(),
      findByIdWithSubject: jest.fn((id: string) =>
        Promise.resolve(makeLink({ id })),
      ),
      findByIdOrFail: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeLink({ id: 'new-link', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };
    subjectRepo = { findByIdOrFail: jest.fn() };

    service = new SubjectGroupService(
      groupRepo as unknown as SubjectGroupRepository,
      linkRepo as unknown as SubjectGroupSubjectRepository,
      subjectRepo as unknown as SubjectRepository,
    );
  });

  describe('create', () => {
    it('creates a global group', async () => {
      groupRepo.findByName.mockResolvedValue(null);
      groupRepo.findByIdWithSubjects.mockResolvedValue(
        makeGroup({ id: 'new-sg' }),
      );

      const result = await service.create({ name: 'Science' });

      expect(groupRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Science', isActive: true }),
      );
      expect(result.id).toBe('new-sg');
    });

    it('rejects a duplicate name', async () => {
      groupRepo.findByName.mockResolvedValue(makeGroup());

      await expect(service.create({ name: 'Science' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('attachSubject', () => {
    it('rejects a subject already in the group', async () => {
      groupRepo.findByIdWithSubjects.mockResolvedValue(makeGroup());
      subjectRepo.findByIdOrFail.mockResolvedValue({ id: 'sub-1' });
      linkRepo.findLink.mockResolvedValue(makeLink());

      await expect(
        service.attachSubject('sg-1', { subjectId: 'sub-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('adds a subject with defaults', async () => {
      groupRepo.findByIdWithSubjects.mockResolvedValue(makeGroup());
      subjectRepo.findByIdOrFail.mockResolvedValue({ id: 'sub-1' });
      linkRepo.findLink.mockResolvedValue(null);

      const link = await service.attachSubject('sg-1', { subjectId: 'sub-1' });

      expect(linkRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectGroupId: 'sg-1',
          subjectId: 'sub-1',
          isCompulsory: true,
        }),
      );
      expect(link.id).toBe('new-link');
    });
  });

  describe('detachSubject', () => {
    it('rejects a link from another group', async () => {
      linkRepo.findByIdOrFail.mockResolvedValue(
        makeLink({ subjectGroupId: 'other' }),
      );

      await expect(service.detachSubject('sg-1', 'link-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
