import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClassRepository } from './class.repository';
import { ClassService } from './class.service';
import { Class } from './entities/class.entity';

const makeClass = (overrides: Partial<Class> = {}): Class => ({
  id: 'cls-1',
  orgId: 'org-1',
  name: 'Grade 1',
  code: null,
  level: 1,
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ClassService', () => {
  let service: ClassService;
  let classRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    classRepo = {
      findByName: jest.fn(),
      findByIdOrFail: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data: Partial<Class>) =>
        Promise.resolve(makeClass({ id: 'new-cls', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
      hasEnrollments: jest.fn().mockResolvedValue(false),
    };

    service = new ClassService(classRepo as unknown as ClassRepository);
  });

  describe('create', () => {
    it('creates a class', async () => {
      classRepo.findByName.mockResolvedValue(null);

      const result = await service.create({ name: 'Grade 1', level: 1 });

      expect(classRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Grade 1', level: 1 }),
      );
      expect(result.id).toBe('new-cls');
    });

    it('rejects a duplicate name', async () => {
      classRepo.findByName.mockResolvedValue(makeClass());

      await expect(service.create({ name: 'Grade 1' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('rejects a name used by another class', async () => {
      classRepo.findByIdOrFail.mockResolvedValue(makeClass());
      classRepo.findByName.mockResolvedValue(makeClass({ id: 'cls-2' }));

      await expect(
        service.update('cls-1', { name: 'Grade 2' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('propagates not-found', async () => {
      classRepo.findByIdOrFail.mockRejectedValue(new NotFoundException());

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses a class with enrolled students (they would go with it)', async () => {
      classRepo.findByIdOrFail.mockResolvedValue(makeClass());
      classRepo.hasEnrollments.mockResolvedValue(true);

      await expect(service.remove('cls-1')).rejects.toMatchObject({
        response: { code: 'CLASS_HAS_STUDENTS' },
      });
      expect(classRepo.deleteById).not.toHaveBeenCalled();
    });

    it('removes a class nobody is enrolled in', async () => {
      classRepo.findByIdOrFail.mockResolvedValue(makeClass());

      await service.remove('cls-1');
      expect(classRepo.deleteById).toHaveBeenCalledWith('cls-1');
    });
  });
});
