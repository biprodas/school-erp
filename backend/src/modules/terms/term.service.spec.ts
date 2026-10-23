import { ConflictException } from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { TermRepository } from './term.repository';
import { TermService } from './term.service';
import { Term } from './entities/term.entity';

describe('TermService', () => {
  let service: TermService;
  let repo: Record<string, jest.Mock>;
  let years: { findById: jest.Mock };

  beforeEach(() => {
    repo = {
      findByName: jest.fn().mockResolvedValue(null),
      findByIdOrFail: jest.fn(),
      saveNew: jest.fn((data: Partial<Term>) => Promise.resolve(data)),
      save: jest.fn((e) => Promise.resolve(e)),
    };
    years = {
      findById: jest
        .fn()
        .mockResolvedValue({ startDate: '2026-01-01', endDate: '2026-12-31' }),
    };
    service = new TermService(
      repo as unknown as TermRepository,
      years as unknown as AcademicYearService,
    );
  });

  const half = {
    academicYearId: 'ay-1',
    name: 'Half-yearly',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
  };

  it('creates a term inside its session', async () => {
    await service.create(half);

    expect(repo.saveNew).toHaveBeenCalledWith({ ...half, sortOrder: 0 });
  });

  it('rejects a term outside the session or ending before it starts', async () => {
    await expect(
      service.create({ ...half, endDate: '2027-01-15' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_DATE_RANGE' } });
    await expect(
      service.create({ ...half, startDate: '2026-07-01' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_DATE_RANGE' } });
  });

  it('rejects a duplicate name in the session', async () => {
    repo.findByName.mockResolvedValue({ id: 'other' });

    await expect(service.create(half)).rejects.toThrow(ConflictException);
    expect(repo.findByName).toHaveBeenCalledWith('ay-1', 'Half-yearly');
  });
});
