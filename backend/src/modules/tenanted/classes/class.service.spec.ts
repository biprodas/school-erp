import { ConflictException, NotFoundException } from '@nestjs/common';
import { SectionRepository } from '../sections/section.repository';
import { ClassRepository } from './class.repository';
import { ClassSectionRepository } from './class-section.repository';
import { ClassService } from './class.service';
import { Class } from './entities/class.entity';
import { ClassSection } from './entities/class-section.entity';

const makeClass = (overrides: Partial<Class> = {}): Class => ({
  id: 'cls-1',
  name: 'Grade 1',
  code: null,
  level: 1,
  description: null,
  isActive: true,
  classSections: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeLink = (overrides: Partial<ClassSection> = {}): ClassSection =>
  ({
    id: 'link-1',
    classId: 'cls-1',
    sectionId: 'sec-1',
    capacity: 30,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ClassSection;

describe('ClassService', () => {
  let service: ClassService;
  let classRepo: Record<string, jest.Mock>;
  let classSectionRepo: Record<string, jest.Mock>;
  let sectionRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    classRepo = {
      findByName: jest.fn(),
      findByIdWithSections: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeClass({ id: 'new-cls', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };
    classSectionRepo = {
      findByClass: jest.fn(),
      findByIdWithSection: jest.fn((id: string) =>
        Promise.resolve(makeLink({ id })),
      ),
      findByIdOrFail: jest.fn(),
      findLink: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeLink({ id: 'new-link', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };
    sectionRepo = {
      findByIdOrFail: jest.fn(),
    };

    service = new ClassService(
      classRepo as unknown as ClassRepository,
      classSectionRepo as unknown as ClassSectionRepository,
      sectionRepo as unknown as SectionRepository,
    );
  });

  describe('create', () => {
    it('creates a class and re-fetches it', async () => {
      classRepo.findByName.mockResolvedValue(null);
      classRepo.findByIdWithSections.mockResolvedValue(
        makeClass({ id: 'new-cls' }),
      );

      const result = await service.create({ name: 'Grade 1', level: 1 });

      expect(classRepo.saveNew).toHaveBeenCalled();
      expect(result.id).toBe('new-cls');
    });

    it('rejects a duplicate name', async () => {
      classRepo.findByName.mockResolvedValue(makeClass());

      await expect(service.create({ name: 'Grade 1' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('attachSection', () => {
    it('rejects attaching a section already linked', async () => {
      classRepo.findByIdWithSections.mockResolvedValue(makeClass());
      sectionRepo.findByIdOrFail.mockResolvedValue({ id: 'sec-1' });
      classSectionRepo.findLink.mockResolvedValue(makeLink());

      await expect(
        service.attachSection('cls-1', { sectionId: 'sec-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('attaches a new section', async () => {
      classRepo.findByIdWithSections.mockResolvedValue(makeClass());
      sectionRepo.findByIdOrFail.mockResolvedValue({ id: 'sec-1' });
      classSectionRepo.findLink.mockResolvedValue(null);

      const link = await service.attachSection('cls-1', {
        sectionId: 'sec-1',
        capacity: 30,
      });

      expect(classSectionRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ classId: 'cls-1', sectionId: 'sec-1' }),
      );
      expect(link.id).toBe('new-link');
    });
  });

  describe('detachSection', () => {
    it('rejects a link belonging to another class', async () => {
      classSectionRepo.findByIdOrFail.mockResolvedValue(
        makeLink({ classId: 'other' }),
      );

      await expect(service.detachSection('cls-1', 'link-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
