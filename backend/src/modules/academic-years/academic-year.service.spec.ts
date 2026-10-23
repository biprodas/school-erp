import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearRepository } from './academic-year.repository';
import { AcademicYearService } from './academic-year.service';
import { AcademicYear } from './entities/academic-year.entity';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';

const makeYear = (overrides: Partial<AcademicYear> = {}): AcademicYear => ({
  id: 'ay-1',
  orgId: 'org-1',
  name: '2025-2026',
  code: null,
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  isCurrent: false,
  isActive: true,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const DATES = { startDate: '2026-01-01', endDate: '2026-12-31' };

describe('AcademicYearService', () => {
  let service: AcademicYearService;
  let repo: Record<string, jest.Mock>;

  beforeEach(() => {
    repo = {
      findByName: jest.fn(),
      findFiltered: jest.fn(),
      findByIdOrFail: jest.fn(),
      clearCurrent: jest.fn(),
      findOverlapping: jest.fn().mockResolvedValue(null),
      findCurrent: jest.fn(),
      saveNew: jest.fn((data: Partial<AcademicYear>) =>
        Promise.resolve(makeYear({ id: 'new-ay', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };

    service = new AcademicYearService(
      repo as unknown as AcademicYearRepository,
      fakeTenantDataSource(),
    );
  });

  describe('create', () => {
    it('creates a year with defaults', async () => {
      repo.findByName.mockResolvedValue(null);

      const result = await service.create({ name: '2025-2026', ...DATES });

      expect(repo.clearCurrent).not.toHaveBeenCalled();
      expect(repo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ name: '2025-2026', isCurrent: false }),
      );
      expect(result.id).toBe('new-ay');
    });

    it('clears the current flag on others when creating a current year', async () => {
      repo.findByName.mockResolvedValue(null);

      await service.create({ name: '2026-2027', isCurrent: true, ...DATES });

      expect(repo.clearCurrent).toHaveBeenCalledWith();
      expect(repo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ isCurrent: true }),
      );
    });

    it('rejects a duplicate name', async () => {
      repo.findByName.mockResolvedValue(makeYear());

      await expect(
        service.create({ name: '2025-2026', ...DATES }),
      ).rejects.toThrow(ConflictException);
      expect(repo.saveNew).not.toHaveBeenCalled();
    });

    it('rejects a session that ends before it starts', async () => {
      repo.findByName.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Backwards',
          startDate: '2026-12-31',
          endDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.saveNew).not.toHaveBeenCalled();
    });

    it('rejects dates that overlap another session', async () => {
      repo.findByName.mockResolvedValue(null);
      repo.findOverlapping.mockResolvedValue(makeYear({ name: '2025' }));

      await expect(
        service.create({ name: '2025-26', ...DATES }),
      ).rejects.toMatchObject({ response: { code: 'SESSION_OVERLAP' } });
      expect(repo.findOverlapping).toHaveBeenCalledWith(
        DATES.startDate,
        DATES.endDate,
        undefined,
      );
    });
  });

  describe('update', () => {
    it('checks overlap against the other sessions when dates change', async () => {
      repo.findByIdOrFail.mockResolvedValue(makeYear({ id: 'ay-1' }));

      await service.update('ay-1', { endDate: '2026-03-31' });

      expect(repo.findOverlapping).toHaveBeenCalledWith(
        '2025-01-01',
        '2026-03-31',
        'ay-1',
      );
    });

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

  describe('getCurrent', () => {
    it('404s when no session is current', async () => {
      repo.findCurrent.mockResolvedValue(null);

      await expect(service.getCurrent()).rejects.toMatchObject({
        response: { code: 'NO_CURRENT_SESSION' },
      });
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
