import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { PromotionOutcome, RollBy } from '../enums/promotion.enum';
import { PromotionService } from './promotion.service';

const enrollment = (id: string, roll: string, name: string, section = 'A') => ({
  id,
  studentId: `s-${id}`,
  rollNo: roll,
  section: { name: section },
  student: { fullName: name },
});

describe('PromotionService (draft)', () => {
  let items: Record<string, unknown>[];
  let enrollments: Record<string, jest.Mock>;
  let sections: { findInYear: jest.Mock; findById: jest.Mock };
  let classes: Record<string, jest.Mock>;

  const build = () =>
    new PromotionService(
      {
        findLive: jest.fn().mockResolvedValue(null),
        saveNew: jest.fn((b) => Promise.resolve({ id: 'b-1', ...b })),
        findByIdOrFail: jest.fn().mockResolvedValue({ id: 'b-1' }),
      } as never,
      {
        saveNew: jest.fn((i: Record<string, unknown>) => {
          items.push(i);
          return Promise.resolve(i);
        }),
        findByBatch: jest.fn(() => Promise.resolve([])),
      } as never,
      {
        findById: jest.fn((id: string) =>
          Promise.resolve({
            id,
            startDate: id === 'y1' ? '2026-01-01' : '2027-01-01',
          }),
        ),
      } as never,
      classes as never,
      sections as never,
      enrollments as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { current: () => ({ userId: 'u-1' }) } as never,
      fakeTenantDataSource(),
    );

  beforeEach(() => {
    items = [];
    enrollments = {
      findActiveInClass: jest
        .fn()
        .mockResolvedValue([
          enrollment('e2', '2', 'Zara'),
          enrollment('e10', '10', 'Anik', 'B'),
          enrollment('e1', '1', 'Mita'),
        ]),
    };
    sections = {
      findInYear: jest.fn().mockResolvedValue([
        { id: 'A7', classId: 'c7', name: 'A', isActive: true },
        { id: 'B7', classId: 'c7', name: 'B', isActive: true },
      ]),
      findById: jest.fn(),
    };
    classes = {
      findById: jest.fn((id: string) =>
        Promise.resolve({ id, level: id === 'c10' ? 10 : 6 }),
      ),
      findAllOrdered: jest.fn().mockResolvedValue([
        { id: 'c6', level: 6, isActive: true },
        { id: 'c7', level: 7, isActive: true },
        { id: 'c10', level: 10, isActive: true },
      ]),
    };
  });

  it('promotes into the next class, same-name sections, rolls by merit (old roll)', async () => {
    await build().create({ fromYearId: 'y1', toYearId: 'y2', classId: 'c6' });

    expect(
      items.map((i) => [
        i.enrollmentId,
        i.outcome,
        i.toClassId,
        i.toSectionId,
        i.newRoll,
      ]),
    ).toEqual([
      ['e1', PromotionOutcome.PROMOTE, 'c7', 'A7', '1'],
      ['e2', PromotionOutcome.PROMOTE, 'c7', 'A7', '2'],
      ['e10', PromotionOutcome.PROMOTE, 'c7', 'B7', '1'],
    ]);
  });

  it('orders alphabetically and spreads over sections when asked', async () => {
    await build().create({
      fromYearId: 'y1',
      toYearId: 'y2',
      classId: 'c6',
      options: { rollBy: RollBy.ALPHABETICAL, shuffleSections: true },
    });

    expect(
      items.map((i) => [i.enrollmentId, i.toSectionId, i.newRoll]),
    ).toEqual([
      ['e10', 'A7', '1'], // Anik
      ['e1', 'B7', '1'], // Mita
      ['e2', 'A7', '2'], // Zara
    ]);
  });

  it('graduates the final class', async () => {
    await build().create({ fromYearId: 'y1', toYearId: 'y2', classId: 'c10' });

    expect(items.every((i) => i.outcome === PromotionOutcome.GRADUATE)).toBe(
      true,
    );
    expect(items.every((i) => i.toClassId === null)).toBe(true);
  });

  it('refuses a target session that is not later', async () => {
    await expect(
      build().create({ fromYearId: 'y2', toYearId: 'y1', classId: 'c6' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_TARGET_SESSION' } });
  });
});
