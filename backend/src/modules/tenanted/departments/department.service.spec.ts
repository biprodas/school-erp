import { ConflictException, NotFoundException } from '@nestjs/common';
import { DepartmentRepository } from './department.repository';
import { DepartmentService } from './department.service';
import { Department } from './entities/department.entity';

const makeDepartment = (overrides: Partial<Department> = {}): Department => ({
  id: 'dept-1',
  name: 'Mathematics',
  code: null,
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('DepartmentService', () => {
  let service: DepartmentService;
  let departmentRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    departmentRepo = {
      findByName: jest.fn(),
      findFiltered: jest.fn(),
      findByIdOrFail: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeDepartment({ id: 'new-dept', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };

    service = new DepartmentService(
      departmentRepo as unknown as DepartmentRepository,
    );
  });

  describe('create', () => {
    it('creates a department with defaults', async () => {
      departmentRepo.findByName.mockResolvedValue(null);

      const result = await service.create({ name: 'Mathematics' });

      expect(departmentRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Mathematics',
          code: null,
          description: null,
          isActive: true,
        }),
      );
      expect(result.id).toBe('new-dept');
    });

    it('rejects a duplicate name', async () => {
      departmentRepo.findByName.mockResolvedValue(makeDepartment());

      await expect(service.create({ name: 'Mathematics' })).rejects.toThrow(
        ConflictException,
      );
      expect(departmentRepo.saveNew).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects a name already used by another department', async () => {
      departmentRepo.findByIdOrFail.mockResolvedValue(
        makeDepartment({ id: 'dept-1', name: 'Mathematics' }),
      );
      departmentRepo.findByName.mockResolvedValue(
        makeDepartment({ id: 'dept-2', name: 'Science' }),
      );

      await expect(
        service.update('dept-1', { name: 'Science' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes after verifying existence', async () => {
      departmentRepo.findByIdOrFail.mockResolvedValue(makeDepartment());

      await service.remove('dept-1');

      expect(departmentRepo.deleteById).toHaveBeenCalledWith('dept-1');
    });

    it('propagates not-found from the repository', async () => {
      departmentRepo.findByIdOrFail.mockRejectedValue(new NotFoundException());

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
