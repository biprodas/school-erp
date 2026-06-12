import { ConflictException, NotFoundException } from '@nestjs/common';
import { AcademicYearRepository } from './academic-year.repository';
import { AcademicYearService } from './academic-year.service';
import { AcademicYear } from './entities/academic-year.entity';

const makeYear = (overrides: Partial<AcademicYear> = {}): AcademicYear => ({
  id: 'ay-1',
  name: '2025-2026',
  code: null,
  startDate: null,
  endDate: null,
  isCurrent: false,
  isActive: true,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AcademicYearService', () => {
  let service: AcademicYearService;
  let repo: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      findByName: jest.fn(),
      findFiltered: jest.fn(),
      findByIdOrFail: jest.fn(),
      clearCurrent: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeYear({ id: 'new-ay', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };

    service = new AcademicYearService(
      repo as unknown as AcademicYearRepository,
    );
  });

  describe('create', () => {
    it('creates a year with defaults', async () => {
      repo.findByName.mockResolvedValue(null);

      const result = await service.create({ name: '2025-2026' });

      expect(repo.clearCurrent).not.toHaveBeenCalled();
      expect(repo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ name: '2025-2026', isCurrent: false }),
      );
      expect(result.id).toBe('new-ay');
    });

    it('clears the current flag on others when creating a current year', async () => {
      repo.findByName.mockResolvedValue(null);

      await service.create({ name: '2026-2027', isCurrent: true });

      expect(repo.clearCurrent).toHaveBeenCalledWith();
      expect(repo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ isCurrent: true }),
      );
    });

    it('rejects a duplicate name', async () => {
      repo.findByName.mockResolvedValue(makeYear());

      await expect(service.create({ name: '2025-2026' })).rejects.toThrow(
        ConflictException,
      );
      expect(repo.saveNew).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('clears current on others when promoting a year to current', async () => {
      repo.findByIdOrFail.mockResolvedValue(makeYear({ isCurrent: false }));

      await service.update('ay-1', { isCurrent: true });

      expect(repo.clearCurrent).toHaveBeenCalledWith('ay-1');
    });

    it('rejects a name already used by another year', async () => {
      repo.findByIdOrFail.mockResolvedValue(makeYear({ id: 'ay-1' }));
      repo.findByName.mockResolvedValue(makeYear({ id: 'ay-2', name: '2027' }));

      await expect(service.update('ay-1', { name: '2027' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('propagates not-found from the repository', async () => {
      repo.findByIdOrFail.mockRejectedValue(new NotFoundException());

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
