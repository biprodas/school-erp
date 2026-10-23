import { ConflictException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { RoomService } from '~/modules/rooms/room.service';
import { ShiftService } from '~/modules/shifts/shift.service';
import { SectionRepository } from './section.repository';
import { SectionService } from './section.service';
import { Section } from './entities/section.entity';

const makeSection = (overrides: Partial<Section> = {}): Section => ({
  id: 'sec-1',
  orgId: 'org-1',
  academicYearId: 'ay-1',
  classId: 'cls-1',
  shiftId: null,
  roomId: null,
  name: 'A',
  capacity: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SectionService', () => {
  let service: SectionService;
  let repo: Record<string, jest.Mock>;
  let years: { findById: jest.Mock };
  let classes: { findById: jest.Mock };
  let shifts: { findById: jest.Mock };
  let rooms: { findById: jest.Mock };

  beforeEach(() => {
    repo = {
      findByName: jest.fn().mockResolvedValue(null),
      findFiltered: jest.fn(),
      findByIdWithRelations: jest.fn((id: string) =>
        Promise.resolve(makeSection({ id })),
      ),
      findInYear: jest.fn().mockResolvedValue([]),
      saveNew: jest.fn((data: Partial<Section>) =>
        Promise.resolve(makeSection({ id: 'new-sec', ...data })),
      ),
      updateFields: jest.fn(),
      deleteById: jest.fn(),
    };
    years = { findById: jest.fn() };
    classes = { findById: jest.fn() };
    shifts = { findById: jest.fn() };
    rooms = { findById: jest.fn() };

    service = new SectionService(
      repo as unknown as SectionRepository,
      years as unknown as AcademicYearService,
      classes as unknown as ClassService,
      shifts as unknown as ShiftService,
      rooms as unknown as RoomService,
    );
  });

  describe('create', () => {
    it('creates a section of a class in a session, in a shift', async () => {
      await service.create({
        academicYearId: 'ay-1',
        classId: 'cls-1',
        name: 'A',
        shiftId: 'shift-1',
      });

      expect(years.findById).toHaveBeenCalledWith('ay-1');
      expect(classes.findById).toHaveBeenCalledWith('cls-1');
      expect(shifts.findById).toHaveBeenCalledWith('shift-1');
      expect(repo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          academicYearId: 'ay-1',
          classId: 'cls-1',
          name: 'A',
          shiftId: 'shift-1',
          roomId: null,
        }),
      );
    });

    it('rejects a name the class already uses in the session', async () => {
      repo.findByName.mockResolvedValue(makeSection());

      await expect(
        service.create({ academicYearId: 'ay-1', classId: 'cls-1', name: 'A' }),
      ).rejects.toThrow(ConflictException);
      expect(repo.findByName).toHaveBeenCalledWith('ay-1', 'cls-1', 'A');
      expect(repo.saveNew).not.toHaveBeenCalled();
    });
  });

  describe('findFiltered', () => {
    it('lists everything when unrestricted', async () => {
      await service.findFiltered({ academicYearId: 'ay-1' }, null);

      expect(repo.findFiltered).toHaveBeenCalledWith(
        { academicYearId: 'ay-1' },
        { academicYearId: 'ay-1' },
      );
    });

    it('narrows to the allowed sections', async () => {
      await service.findFiltered({}, ['sec-1', 'sec-2']);

      expect(repo.findFiltered).toHaveBeenCalledWith(
        { id: In(['sec-1', 'sec-2']) },
        {},
      );
    });

    it('returns an empty page without querying when nothing is allowed', async () => {
      const page = await service.findFiltered({ page: 1, limit: 10 }, []);

      expect(page.items).toEqual([]);
      expect(page.meta.total).toBe(0);
      expect(repo.findFiltered).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('404s for a missing section', async () => {
      repo.findByIdWithRelations.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('copyToYear', () => {
    const source = [
      makeSection({ id: 'a', classId: 'c6', name: 'A', shiftId: 'morning' }),
      makeSection({ id: 'b', classId: 'c6', name: 'B' }),
    ];

    it('copies every section into the target with new ids', async () => {
      repo.findInYear.mockImplementation((year: string) =>
        Promise.resolve(year === 'from' ? source : []),
      );
      repo.saveNew.mockImplementation((data: Partial<Section>) =>
        Promise.resolve(makeSection({ ...data, id: `new-${data.name}` })),
      );

      const result = await service.copyToYear('from', 'to', false);

      expect(result).toMatchObject({ created: 2, skipped: 0 });
      expect([...result.ids]).toEqual([
        ['a', 'new-A'],
        ['b', 'new-B'],
      ]);
      expect(repo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          academicYearId: 'to',
          classId: 'c6',
          shiftId: 'morning',
        }),
      );
    });

    it('refuses a clash unless merging, which maps to the existing one', async () => {
      const existing = makeSection({ id: 'old-a', classId: 'c6', name: 'a ' });
      repo.findInYear.mockImplementation((year: string) =>
        Promise.resolve(year === 'from' ? source : [existing]),
      );

      await expect(service.copyToYear('from', 'to', false)).rejects.toThrow(
        ConflictException,
      );

      repo.saveNew.mockClear();
      const merged = await service.copyToYear('from', 'to', true);
      expect(merged).toMatchObject({ created: 1, skipped: 1 });
      expect(merged.ids.get('a')).toBe('old-a');
      expect(repo.saveNew).toHaveBeenCalledTimes(1);
    });
  });
});
